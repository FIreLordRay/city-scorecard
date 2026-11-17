# Pulse at TechBash: 3-minute demo

Tuesday Nov 17, Zhou B Art Center, 1029 W 35th St. Each round is 3 minutes, so the demo takes 60 seconds and the rest is conversation.

## Before you leave

- Phone charged, app open on the home page (`#home`).
- Data refreshed Nov 16 night (90 days ending Nov 16, 2026).
- If venue Wi-Fi is slow, the app still loads from the saved snapshot. Only the address search needs the internet.

## The 60 seconds

**1. The hook (10s)**
"I'm RayMond, Cycle 60. I built Pulse, a scorecard that grades how well Chicago serves each neighborhood, using the city's own 311 data."

**2. Make it about them (20s)**
Type the venue address: **1029 W 35th St** → Find my block.
"This is where we're standing. Bridgeport gets a B. 311 requests here close 8% faster than the city average. Your alderman is Nicole Lee, Ward 11, and the closest free clinic is 2 km away."

**3. The finding (20s)**
Tap back, open **Does income change the wait?**
"In Chicago's poorest neighborhoods, the same 311 request takes 14% longer to close than in the richest. Yard waste pickup: about 2 days in the richest areas, 12 in the poorest."

**4. Hand it over (10s)**
"It's React, pulling live from the Chicago Data Portal, with census income data and federal clinic listings. What would you want a tool like this to measure?"

## Questions they might ask

- **Where does the data come from?** Chicago Data Portal 311 requests, the census (ACS) for income, HRSA and CDPH for clinics.
- **Is the gap caused by income?** No claim of cause. It shows income and wait go together. Staffing by district could be the reason.
- **How is it fair to compare?** Each neighborhood is compared against the city average for the same mix of request types, so a rat complaint is only compared with rat complaints.
- **Privacy?** Your address goes to OpenStreetMap's search only. It isn't saved, and shared links name only the neighborhood.
- **What's next?** Ask them. Good follow-up for a card exchange.
