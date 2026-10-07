# Played

Played is a free website for golfers in Canada. Signed-in home is one page: a pin map, the percentage of courses played, and one list. Canada is the wide view. A province chip refits the map and the percentage to that province. There is no native app.

Played pins are green teardrops. Unplayed courses are small white dots. Click a pin to record a round. Expand that window for the course photo, website, and, when that course has turned it on, a booking link or a phone number. Private courses do not show Book or Call.

## Run

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database is SQLite at `data/played.sqlite`. It is created on first start and filled from `data/facilities.json`. Override the file with `PLAYED_DB`.

A production build is `npm run build` and `npm start`.

## Accounts

Passwords are hashed with scrypt and must be at least 10 characters. The session is an HTTP-only cookie. A golfer confirms their email before marking a course.

Set `RESEND_API_KEY` and `RESEND_FROM` to send the confirmation and password-reset links. Without those, the link is shown on the next screen.

Connect lists Golf Canada, GHIN, and 18Birdies. Live Golf Canada and GHIN pulls stay closed until `GOLFCANADA_CLIENT_ID` and `GOLFCANADA_CLIENT_SECRET`, or `GHIN_CLIENT_ID` and `GHIN_CLIENT_SECRET`, are set. The score feed itself is not connected yet, and Played does not ask for those passwords. 18Birdies has no live connection. A golfer can add a download of their own account when each round includes a course, a date, and 9 or 18 holes.

## Booking

`data/reach.json` holds a booking link or a phone number for public courses, found from the club’s site. Each row stays off until `enabled` is true. The whole feature stays off until `BOOKING_ENABLED=1`. Private courses never show the action. `data/reach-trouble.json` lists public courses the scan could not resolve. Run `node scripts/scan-reach.mjs` to scan again. A rerun skips courses that already have both a link and a phone.

## Coverage

The percentage is played facilities divided by the facilities in the current view, province or Canada. A round counts when it is 9 or 18 holes. This year and earlier use the calendar year of `played_on` in America/Halifax. One played course in a large view shows as <1%.

## Course file

`data/facilities.json` has 1,679 outdoor facilities: BC 218, AB 239, SK 157, MB 86, ON 612, QC 222, NB 49, PEI 18, NS 57, NL 17, YT 2, NT 2. Atlantic rows come from the provincial member lists. The other provinces come from the public Golf Canada facility search. One outdoor facility is one course. Indoor simulators are omitted. Public and semi-public are public. Private stays private.

National list and public list filters name courses on a published Canadian ranking. Played does not publish that ranking, and the percentage still counts every course.

Rebuild the Atlantic seed with `npm run seed` if those public pages need another pass. The script needs network access.
