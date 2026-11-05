# Chicago City Scorecard

How well is Chicago serving its residents? Built from 311 requests, census income data and city clinic locations from the Chicago Data Portal.

- **Service tracker:** requests, backlog and close times for the last 90 days
- **Service ratings:** each service ranked on speed and backlog (computed from 311 records, not votes)
- **Neighborhood scorecard:** all 77 community areas graded A to F
- **Health access map:** distance from each neighborhood to the nearest city health clinic
- **Who waits longer:** the same type of request takes longer to close in the poorest neighborhoods than in the richest

## Run it

```bash
npm install
npm run dev
```

`npm run snapshot` saves today's data to `public/snapshot.json`, which the app shows instantly while live data loads. Refresh it before a demo.

`npm test` runs the scoring tests.
