import { readFileSync, writeFileSync } from "node:fs";

const facilities = JSON.parse(readFileSync(new URL("../data/facilities.json", import.meta.url), "utf8")).facilities;

const national = [
  "Cabot Cliffs", "Cabot Links", "St George's Golf Club", "Toronto Golf Club", "Jasper Park Golf Club",
  "Capilano", "Hamilton", "Banff Springs", "Beacon Hall", "Memphremagog", "Paintbrush", "Pulpit",
  "Highlands Links", "Cape Breton Highlands", "Westmount", "Victoria Golf Club", "Sagebrush",
  "Shaughnessy", "Greywolf", "Coppinwood", "Blackhawk", "Oviinbyrd", "Avalon Club", "Tobiano",
  "Predator Ridge", "Muskoka Bay", "London Hunt", "Mount Bruno", "Laval-Sur-Le-Lac", "Laval Sur Le Lac",
  "Mad River", "Calgary Golf", "Royal Montreal", "Mickelson National", "Bigwin", "Cherry Hill",
  "Big Sky", "Royal Colwood", "Humber Valley", "Waskesiu", "St. Thomas", "Weston Golf",
  "Osprey Valley", "Rocky Crest", "Redtail", "Rosedale", "Georgian Bay", "Muskoka Lakes",
  "Algonquin Golf", "Lookout Point", "Vancouver Golf Club", "Mississaugua", "The Summit",
  "Ottawa Hunt", "Crowbush", "Manitou", "Eagle's Nest", "Eagles Nest", "Kananaskis",
  "Stewart Creek", "Deer Ridge", "Bear Mountain", "Beaconsfield", "Royal Ottawa", "Grand Mere",
  "Tarandowah", "St. Charles", "Burlington Golf", "Essex Golf", "Cutten Fields", "Brantford Golf",
  "Northumberland Links", "Oakdale", "Riverside Country Club", "Maple Downs", "Wildfire",
  "Knowlton", "Scarboro", "Glencoe", "Rivermead", "Wildstone", "Talking Rock", "Cobble Beach",
  "Royal Mayfair", "Shadow Mountain", "Marine Drive", "Magna", "Black Bear Ridge", "Credit Valley",
  "Cataraqui", "Dundarave", "Priddis", "Wolf Creek", "Kawartha", "Copper Creek",
];

const publicNames = [
  "Cabot Cliffs", "Cabot Links", "Jasper Park", "Banff Springs", "Highlands Links", "Cape Breton Highlands",
  "Predator Ridge", "Tobiano", "Crowbush", "Osprey Valley", "Kananaskis", "Bear Mountain",
  "Manoir Richelieu", "Friday Harbour", "Brunello", "Wolf Creek", "Deerhurst", "Copper Point",
  "Greywolf", "Sagebrush", "Humber Valley", "Muskoka Bay", "Rocky Crest", "Algonquin",
  "Big Sky", "Waskesiu", "Stewart Creek", "Black Bear Ridge",
];

function norm(value) {
  return value.normalize("NFKC").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function find(name) {
  const needle = norm(name);
  const hits = facilities.filter((facility) => {
    const official = norm(facility.official_name);
    const record = norm(facility.record_name ?? "");
    return official.includes(needle) || record.includes(needle) || needle.includes(official);
  });
  if (hits.length === 0) return [];
  hits.sort((a, b) => norm(a.official_name).length - norm(b.official_name).length);
  return hits.slice(0, needle.length < 8 ? 1 : 3).map((facility) => facility.facility_id);
}

function collect(names) {
  const ids = [];
  const missed = [];
  for (const name of names) {
    const hits = find(name);
    if (hits.length === 0) missed.push(name);
    for (const id of hits) if (!ids.includes(id)) ids.push(id);
  }
  return { ids, missed };
}

const nationalMatch = collect(national);
const publicMatch = collect(publicNames);
writeFileSync(
  new URL("../data/rankings.json", import.meta.url),
  `${JSON.stringify({
    note: "Facility ids named on a published Canadian ranking. The publisher’s scores and article text are not stored.",
    national: nationalMatch.ids,
    public: publicMatch.ids,
  }, null, 2)}\n`,
);
console.log("national", nationalMatch.ids.length, "missed", nationalMatch.missed.join(", ") || "none");
console.log("public", publicMatch.ids.length, "missed", publicMatch.missed.join(", ") || "none");
