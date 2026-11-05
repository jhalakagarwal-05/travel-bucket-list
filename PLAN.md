# Wanderlist — Project Plan

## 1. PITCH

I'm building Wanderlist, a personal travel bucket list app, because I want a record of the places I've visited alongside the places I still want to go. I'll use it after every trip, and most heavily over the next two months while I log past trips and plan winter break.

## 2. FEATURES

User stories, in build order:

1. As a new visitor, I want to sign up with email and password, log in, and log out, so that my bucket list is private to me.
2. As a user, I want my data stored in a database with users, destinations, and categories, so that my list persists.
3. As a user, I want to add a destination, see my list, open a detail page, edit it, and delete it with an "Are you sure?" confirmation, so that I can manage my list.
4. As a user, I want to see a friendly error if I leave the name or country blank, so that my entries are complete.
5. As a user, I want to star destinations and see a "Starred" view, so that I can find my top picks fast.
6. As a user, I want to filter by status, category, or country, and sort by priority or newest, so that I can find places quickly.
7. As a user, I want a dashboard with a chart of destinations by category and stats (total destinations, number visited, average priority), so that I can see my travel progress.
8. As a user, I want a map view with a pin for each destination, colored by status, so that I can see my list geographically.
9. As a user, I want a "Surprise me" button that picks a random destination from my dream list, so that I get inspiration.
10. As a user, I want a public read-only share link for my bucket list, so that friends and family can see it without logging in.

## 3. DATABASE

- **users:** `id` (number, primary key), `email` (text, unique), `password_hash` (text), `created_at` (date)
- **categories:** `id` (number, primary key), `name` (text; examples: Beach, City, Hiking, Food, Family)
- **destinations:** `id` (number, primary key), `user_id` (number, references users), `category_id` (number, references categories), `name` (text, required), `country` (text, required), `status` (text: dream / planned / visited), `priority` (number 1–5), `estimated_cost` (number), `visited_date` (date, optional), `latitude` (number), `longitude` (number), `notes` (text), `created_at` (date)
- **stars:** `id` (number, primary key), `user_id` (number, references users), `destination_id` (number, references destinations); a user can star a destination only once.
- **share_links:** `id` (number, primary key), `user_id` (number, references users), `token` (text, unique), `created_at` (date)

Relationships: one user has many destinations, stars, and share links; one category has many destinations; one destination can have many stars.

## 4. TESTS

- **Data isolation:** Given User A is logged in and has added a destination called "Kyoto", when User B logs in and opens their destinations list, then User B sees an empty list and cannot open User A's destination by its URL.
- **Dashboard stat:** Given a user has 3 destinations with priorities 2, 4, and 5, when they open the dashboard, then "Average priority" shows 3.7.

Tests will be written with Vitest. For each test, I will break the feature on purpose, show it failing (red), revert the break, and show it passing (green).

## 5. TECHNOLOGIES

- **Coding agent:** Replit Agent, because it can write code, set up the database, and deploy in one place.
- **Database:** Replit's built-in PostgreSQL, because it's included in Replit and handles relationships between tables well.
- **Sign up and login:** Email and password stored in my own users table, with passwords hashed using bcrypt and session-based login, because the assignment requires accounts created inside the app and each user seeing only their own data.
- **Hosting:** Replit Deployments, because it publishes the app to a live URL directly from my project.
- **Map:** Leaflet with OpenStreetMap tiles, because it's free and needs no API key.
- **Charts:** Chart.js, because it's simple and well documented for the dashboard's bar and pie charts.
- **Testing:** Vitest, because it's fast and works well with a JavaScript project.
- **Code hosting:** GitHub, with every change merged into main through a pull request, as the assignment requires.

## 6. DESIGN

- **Style:** Clean, airy, travel-journal feel, with rounded cards and plenty of white space.
- **Colors:** White background, teal (`#0F766E`) as the main accent, warm sand (`#F4E4C1`) for highlights, and dark slate (`#1E293B`) for text.
- **Status colors:** Dream is purple, planned is amber, and visited is green; use these colors on destination cards and map pins.
- **Font:** A friendly sans-serif such as Inter.
- **Layout:** A top navigation bar with My List, Starred, Map, Dashboard, and Log out; show destinations in a grid of cards.
- **Inspiration:** Airbnb Wishlists (card layout and saving favorites) and Google Maps saved places (pins on a map).

## 7. RISKS AND CUTS

- **Least sure I can build:** The map view (needs latitude and longitude for each destination).
- **First to cut if short on time:** The public share link.

## Plan vs. Reality

| Planned feature | Shipped / Changed / Cut | Status (Done/Backlogged) | Learning | What changed and why |
|---|---|---|---|---|
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
