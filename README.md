# Played

Played is a free website for golfers in Atlantic Canada. Home is the course list for a home-screen province (Nova Scotia, Prince Edward Island, New Brunswick, or Newfoundland and Labrador), split into played and not played, with the percentage and the counts. Atlantic is a switch on that page. There is no native app, no payment, and no live Golf Canada or GHIN login.

## Run

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database is SQLite at `data/played.sqlite`. It is created on first start and filled from `data/facilities.json`. Override the file with `PLAYED_DB`.

## Email confirmation and password reset

This build does not send email. After you create an account, the confirmation link is shown on the next screen. Password reset works the same way: enter the email, and if the account exists the reset link is shown on the next screen. Replace that with a mail provider before a public launch. A golfer cannot mark a course or import a file until the email is confirmed. The session is an HTTP-only cookie.

Passwords are hashed with scrypt and must be at least 10 characters.

## Coverage

Coverage is a pure function of matched 9- and 18-hole rounds and the selected denominator. Home reads a summary that is rewritten in the same transaction as a round change. It does not scan every round to draw the percentage.

This year and earlier use the calendar year of `played_on` in America/Halifax. They split the played courses and do not overlap.

## Course seed

Names come from the public member lists:

- Nova Scotia: [Golf Nova Scotia member clubs](https://nsga.ns.ca/member-clubs/)
- Prince Edward Island: [Golf PEI course directory](https://golfpei.ca/course_directory_list/)
- New Brunswick: [Golf New Brunswick member facilities](https://www.golfnb.ca/member-facilities/)
- Newfoundland and Labrador: [Golf Newfoundland Labrador member courses](https://www.golfnl.ca/member-courses/)

Hole count, public or private, coordinates, and association course ids come from the public Golf Canada facility record those association sites use, except where noted. A facility with more than one routing of the same published name is one row. `hole_count` is the longest routing. Pippy Park (Admiral’s Green, 18, and Captain’s Hill, 9) is the worked example.

The seed currently holds 57 Nova Scotia facilities, 18 Prince Edward Island courses, 49 New Brunswick facilities, and 17 Newfoundland and Labrador courses.

Gaps:

- Golf Nova Scotia’s page names Cabot Cliffs and Cabot Links on one line, and Ashburn Old and New on one line. Each is two facilities because the list names them separately.
- Cabot The Nest is on the Nova Scotia list. Golf Canada has no separate facility id. The row uses Cabot’s public page, which describes an 11-hole par-3 course a non-member can book. No coordinates.
- Rustico Resort Golf Club is on the Golf PEI directory. It is not in the Golf Canada facility search. The Golf PEI page says 18 holes and offers a tee time. No coordinates.
- Golf New Brunswick’s live member page lists 52 names, against a published size of about 53. GreyRock Golf, JH Sports, and Top Shots Golf are indoor simulators on that page, so they are not in the outdoor seed. The other 49 are included.
- These rows have no coordinates and sort last, labeled distance unavailable: Under Par Golf & Academy, Aspotogan Ridge Golf Club, Dundarave Golf Course, Rustico Resort Golf Club, and Cabot The Nest.
- Public or private follows the Golf Canada class. Public and semi-public are public, because a non-member can book a tee time. Private stays private.

Rebuild the seed with `npm run seed` if those public pages need another pass. The script needs network access.
