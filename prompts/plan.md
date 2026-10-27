# Prompt log: PLAN.md

## Prompt 1: Initial plan request

I'm building a web app called Wanderlist, a personal travel bucket list. Do NOT write any app code yet. Your only task right now is to create a file called PLAN.md in the root of the repo with the 7 sections below, using exactly the decisions I give you. Keep it specific and 1–3 pages.

1. PITCH

I'm building Wanderlist because I want a record of the places I've visited alongside the places I still want to go. I’ll use it after every trip, and most heavily over the next two months while I log past trips and plan winter break, after each trip and when planning the next one.

2. FEATURES (user stories, numbered in build order)
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

3. DATABASE
- users: id, email (unique), password_hash, created_at
- categories: id, name
- destinations: id, user_id, category_id, name (required), country (required), status (dream / planned / visited), priority (1–5), estimated_cost, visited_date, latitude, longitude, notes, created_at
- stars: id, user_id, destination_id (a user can star a destination only once)
- share_links: id, user_id, token (unique), created_at
Relationships: one user has many destinations; one category has many destinations; users and destinations are many-to-many through stars.

4–7: Tests, Technologies, Design, Risks and cuts (see Prompt 2 and 3).

Leave a placeholder heading at the bottom called "Plan vs. Reality" with an empty table. When done, stop. Do not create any other files.

## Prompt 2: Sections 4–7 (Replit asked for exact details)

4. TESTS
- Data isolation: Given User A is logged in and has added a destination called "Kyoto", when User B logs in and opens their destinations list, then User B sees an empty list and cannot open User A's destination by its URL.
- Dashboard stat: Given a user has 3 destinations with priorities 2, 4, and 5, when they open the dashboard, then "Average priority" shows 3.7.

5. TECHNOLOGIES
- Coding agent: Replit Agent, because it can write code, set up the database, and deploy in one place.
- Database: Replit's built-in PostgreSQL, because it handles relationships between tables well.
- Sign up and login: email and password in my own users table, hashed with bcrypt, session-based login.
- Hosting: Replit Deployments.
- Map: Leaflet with OpenStreetMap, free and no API key.
- Charts: Chart.js.
- Testing: Vitest.
- Code hosting: GitHub, with every change merged through a pull request.

7. RISKS AND CUTS
- Least sure I can build: the map view, because each destination needs latitude and longitude. Fallback: enter coordinates manually.
- First to cut: the public read-only share link.

## Prompt 3: Design section

Replit left Section 6 as a placeholder, so I gave it my design choices:
- Style: clean, airy, travel-journal feel, with rounded cards and plenty of white space.
- Colors: white background, teal (#0F766E) accent, warm sand (#F4E4C1) highlights, dark slate (#1E293B) text.
- Status colors: dream = purple, planned = amber, visited = green.
- Font: Inter.
- Layout: top nav with My List, Starred, Map, Dashboard, Log out; destinations as a grid of cards.
- Inspiration: Airbnb Wishlists and Google Maps saved places.

## What went wrong and how I fixed it

1. Replit Agent left the Design section as a placeholder instead of using my choices. I noticed when it said so in its reply, and fixed it with Prompt 3.
2. Replit Agent committed PLAN.md directly to main, which breaks the "nothing committed directly to main" rule. I noticed when `git log` showed the plan commits on main. I fixed it by saving the commits to a new `plan` branch (`git branch plan`), resetting main to the commit before the plan (`git reset --hard 0884529`), and then merging the plan through a pull request.

Lesson: Replit Agent auto-commits to whatever branch is checked out, so I now create a feature branch before every prompt.