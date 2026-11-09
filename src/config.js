// Where residents send feedback. Paste your form's share link here and the "Tell us what's missing"
// button appears in every neighborhood panel; leave it empty and the button stays hidden.
//
// Google Forms: Send > link icon > copy. To pre-fill the neighborhood name, add a short-answer question
// "Neighborhood", use "Get pre-filled link" on it, and put the entry id (e.g. "entry.123456789") below.
export const FEEDBACK_FORM_URL = ''
export const FEEDBACK_NEIGHBORHOOD_FIELD = ''

// Chicago's official 311 portal, where a request actually gets logged and counted.
export const CITY_311_URL = 'https://311.chicago.gov/'

export const feedbackUrl = (neighborhood) => {
  if (!FEEDBACK_FORM_URL) return null
  if (!FEEDBACK_NEIGHBORHOOD_FIELD) return FEEDBACK_FORM_URL
  const sep = FEEDBACK_FORM_URL.includes('?') ? '&' : '?'
  return `${FEEDBACK_FORM_URL}${sep}${FEEDBACK_NEIGHBORHOOD_FIELD}=${encodeURIComponent(neighborhood)}`
}
