Do three things. Don't change any app code.

1. Write README.md: what Wanderlist does (a personal travel bucket list to record places I've visited and places I want to go), the live URL (https://eager-darkblue-demand.replit.app), the tools used (Replit Agent, PostgreSQL, Drizzle, Express, React, Leaflet/OpenStreetMap, Chart.js, Vitest, GitHub), how to run it locally, and how to run tests (npm test and npm run test:required).

2. Write schema.md: every table, its columns and types, primary keys, and how the tables relate, with a simple text diagram. Add a section "Differences from PLAN.md section 3" listing anything the built schema does differently (for example, the sessions table, and share_links storing a hashed token).

3. In PLAN.md, fill in ONLY the "Plan vs. Reality" table at the bottom with these rows. Don't change anything else in PLAN.md:
| Sign up and login | Changed | Done | Login needs session storage I hadn't designed | Agent added a sessions table to store logins in PostgreSQL |
| Data model | Shipped | Done | Specifying exact columns made the Agent build exactly what I designed | Built as planned |
| CRUD | Shipped | Done | The Agent couldn't test signed-in screens, so I had to test manually | Built as planned |
| Validation | Shipped | Done | Combining small features saved time | Built in the same PR as CRUD |
| Stars | Shipped | Done | A junction table keeps one stars table for all users | Built as planned |
| Search, filter, sort | Changed | Done | The Agent adds extras unless told not to | Agent added result counts and a clear-filters button |
| Dashboard | Shipped | Done | Writing the expected value (3.7) in the plan made it easy to test | Built as planned |
| Map view | Changed | Done | My "riskiest" feature took minutes once the Agent had a clear spec | Added a Find location lookup; a Replit-suggested task added a list of unmapped places |
| Surprise me | Shipped | Done | Small, well-scoped features are fast | Built as planned |
| Public share link | Changed | Done | The Agent made security choices I hadn't specified | Token stored as a hash; added a way to turn the link off |
| Tests | Changed | Done | A test can fail for the wrong reason | The first isolation test depended on existing data, so I had it rewritten with fresh users |
| Publishing | Changed | Done | Deployment needs its own run command | Publishing failed until the Agent added build and run commands to .replit |

Save this prompt verbatim to prompts/docs.md.
