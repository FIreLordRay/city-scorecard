import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { title, fmt } from './score.js'

// Interactive 3D version of the health map: each neighborhood is raised by its distance to the nearest
// city clinic, so tall means far from care. Same colors as the flat map.
const LAT0 = 41.84, LNG0 = -87.68
const KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180), KY = 110.574
const toKm = ([lng, lat]) => new THREE.Vector2((lng - LNG0) * KX, (lat - LAT0) * KY)
const HEIGHT = 0.9// scene units per km of clinic distance

function shapesOf(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polys.map(([outer, ...holes]) => {
    const shape = new THREE.Shape(outer.map(toKm))
    holes.forEach((h) => shape.holes.push(new THREE.Path(h.map(toKm))))
    return shape
  })
}

export default function Health3D({ areas, places, kinds, color, sel, setSel }) {
  const host = useRef(null)
  const api = useRef({})
  const [tip, setTip] = useState(null)
  const labels = useRef(null)
  const live = useRef({})
  live.current = { setSel, sel } // latest props for code running inside the long-lived scene effect

  useEffect(() => {
    const el = host.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#152b12')
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400)
    camera.position.set(0, 60, 62)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    el.appendChild(renderer.domElement)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2d3d1a, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.8)
    sun.position.set(-20, 50, 30)
    scene.add(sun)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI / 2.1
    controls.minDistance = 15
    controls.maxDistance = 140

    // Z is "up" while building, so tip the group: map north ends up away from the camera.
    const world = new THREE.Group()
    world.rotation.x = -Math.PI / 2
    scene.add(world)

    const meshes = []
    for (const a of areas) {
      const mat = new THREE.MeshStandardMaterial({ color: color(a.clinicKm), roughness: 0.85 })
      const geo = new THREE.ExtrudeGeometry(shapesOf(a.feature.geometry), { depth: Math.max(0.3, a.clinicKm * HEIGHT), bevelEnabled: false })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.userData.area = a
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 40), new THREE.LineBasicMaterial({ color: 0x152b12 }))
      mesh.add(edges)
      world.add(mesh)
      meshes.push(mesh)
    }

    // Name labels: one HTML div per neighborhood, floated over its roof. Each frame the ones that would
    // overlap are hidden, biggest neighborhoods first, so zooming in reveals more names.
    const labelHost = labels.current
    const labels3 = areas.map((a) => {
      const polys = a.feature.geometry.type === 'Polygon' ? [a.feature.geometry.coordinates] : a.feature.geometry.coordinates
      const ring = polys.map((p) => p[0]).sort((m, n) => n.length - m.length)[0].map(toKm)
      const c = ring.reduce((s, v) => s.add(v), new THREE.Vector2()).divideScalar(ring.length)
      const xs = ring.map((v) => v.x), ys = ring.map((v) => v.y)
      const size = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
      const div = document.createElement('div')
      div.className = 'label3d'
      div.textContent = title(a.name)
      labelHost.appendChild(div)
      return { id: a.id, div, size, pos: new THREE.Vector3(c.x, Math.max(0.3, a.clinicKm * HEIGHT) + 0.2, -c.y), w: title(a.name).length * 6.4 + 10 }
    }).sort((m, n) => n.size - m.size)
    const placeLabels = () => {
      const W = el.clientWidth, H = el.clientHeight, taken = []
      const picked = live.current.sel
      const order = [...labels3].sort((m, n) => (n.id === picked) - (m.id === picked))
      const v = new THREE.Vector3()
      for (const l of order) {
        v.copy(l.pos).project(camera)
        const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H
        const box = [x - l.w / 2, y - 18, x + l.w / 2, y]
        const hidden = v.z > 1 || box[0] < 0 || box[2] > W || box[1] < 0 || box[3] > H ||
          taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1])
        l.div.style.display = hidden ? 'none' : 'block'
        if (!hidden) { taken.push(box); l.div.style.transform = `translate(${x - l.w / 2}px, ${y - 18}px)`; l.div.classList.toggle('on', l.id === picked) }
      }
    }

    // Clinics sit on top of whatever neighborhood they are in: drop a ray from above to find the roof.
    world.updateMatrixWorld(true)
    const down = new THREE.Raycaster()
    const pins = new THREE.Group()
    const seen = new Set()
    for (const p of places) {
      const key = p.kind + p.name + p.address
      if (seen.has(key)) continue
      seen.add(key)
      const v = toKm([p.lng, p.lat])
      down.set(new THREE.Vector3(v.x, 200, -v.y), new THREE.Vector3(0, -1, 0))
      const hit = down.intersectObjects(meshes, false)[0]
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(p.kind === 'city' ? 0.45 : 0.35, 12, 8),
        new THREE.MeshBasicMaterial({ color: kinds[p.kind][1] }),
      )
      pin.position.set(v.x, (hit ? hit.point.y : 0) + 0.5, -v.y)
      pin.userData.place = p
      pins.add(pin)
    }
    scene.add(pins)

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const pinHit = ray.intersectObjects(pins.children, false)[0]
      if (pinHit) return { place: pinHit.object.userData.place }
      const hit = ray.intersectObjects(meshes, false)[0]
      return hit ? { area: hit.object.userData.area } : null
    }
    const dom = renderer.domElement
    let down0 = null
    const onMove = (e) => {
      const h = pick(e)
      dom.style.cursor = h ? 'pointer' : 'grab'
      const r = el.getBoundingClientRect()
      setTip(h ? { x: e.clientX - r.left, y: e.clientY - r.top, ...h } : null)
    }
    const onDown = (e) => { down0 = [e.clientX, e.clientY] }
    const onUp = (e) => {
      // A click, not a drag-to-rotate.
      if (!down0 || Math.hypot(e.clientX - down0[0], e.clientY - down0[1]) > 5) return
      const h = pick(e)
      if (h?.area) live.current.setSel(h.area.id)
    }
    const onLeave = () => setTip(null)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointerup', onUp)
    dom.addEventListener('pointerleave', onLeave)

    let raf
    const frame = () => { controls.update(); renderer.render(scene, camera); placeLabels(); raf = requestAnimationFrame(frame) }
    frame()

    api.current = { meshes, controls, camera }
    return () => {
      cancelAnimationFrame(raf)
      labels3.forEach((l) => l.div.remove())
      ro.disconnect()
      controls.dispose()
      for (const m of meshes) { m.geometry.dispose(); m.material.dispose(); m.children[0].geometry.dispose(); m.children[0].material.dispose() }
      for (const p of pins.children) { p.geometry.dispose(); p.material.dispose() }
      renderer.dispose()
      dom.remove()
    }
  }, [areas, places, kinds, color])

  // Lift the picked neighborhood and turn the camera toward it.
  useEffect(() => {
    const { meshes, controls } = api.current
    if (!meshes) return
    for (const m of meshes) {
      const on = m.userData.area.id === sel
      m.material.emissive.set(on ? 0xf7f2e4 : 0x000000)
      m.material.emissiveIntensity = on ? 0.45 : 0
      if (on) {
        const box = new THREE.Box3().setFromObject(m)
        controls.target.copy(box.getCenter(new THREE.Vector3())).setY(0)
      }
    }
    if (!sel) controls.target.set(0, 0, 0)
  }, [sel])

  const a = tip?.area, p = tip?.place
  return (
    <div className="map three" ref={host} role="img"
      aria-label="Interactive 3D map of Chicago neighborhoods. Taller means farther from the nearest city clinic. Use the neighborhood picker above or the clinic list below for the same information as text.">
      <div className="labels3d" ref={labels} aria-hidden="true" />
      {tip && (
        <div className="tip3d" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          {a && <><b>{title(a.name)}</b><br />Grade {a.grade} · nearest city clinic {fmt(a.clinicKm, 1)} km</>}
          {p && <><b>{p.name}</b><br />{kinds[p.kind][0]}</>}
        </div>
      )}
      <p className="hint3d">Drag to rotate · scroll to zoom · right-drag to pan · click a neighborhood</p>
    </div>
  )
}
