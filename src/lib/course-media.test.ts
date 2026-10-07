import { describe, expect, it } from "vitest";
import {
  canadianPhone,
  golfContact,
  mediaFromDetail,
  mediaFromSearch,
  parseClubPage,
  photoUrl,
  reachForAccess,
  shownReach,
} from "./course-media";

describe("course preview media", () => {
  it("keeps a course photo and the club site, and skips a logo", () => {
    expect(photoUrl("https://scg.golfcanada.ca/uploads/facility/Logo/32751_CabotCliffs.png")).toBeNull();
    const media = mediaFromDetail(
      {
        data: {
          facilityName: "Cabot Cliffs",
          imagePath: "https://scg.golfcanada.ca/uploads/facility/Photo/21751_CabotCliffs.jpg",
          url: null,
          teeTimeUrl: "https://www.cabotlinks.com/make-a-reservation/",
        },
      },
      "Cabot Cliffs",
    );
    expect(media).toEqual({
      photoUrl: "https://scg.golfcanada.ca/uploads/facility/Photo/21751_CabotCliffs.jpg",
      websiteUrl: "https://www.cabotlinks.com/",
      bookingUrl: "https://www.cabotlinks.com/make-a-reservation/",
      phone: null,
    });
  });

  it("ignores a facility record whose name does not match", () => {
    expect(
      mediaFromDetail({ data: { facilityName: "Mount Maunganui Golf Club", imagePath: null, url: null } }, "Cabot Cliffs"),
    ).toBeNull();
  });

  it("reads a photo from the public search when the name matches", () => {
    const media = mediaFromSearch(
      {
        data: [
          {
            name: "Cabot Cliffs",
            image: "https://scg.golfcanada.ca/uploads/facility/Logo/32751_CabotCliffs.png",
            outdoor_details: {
              image_url: "https://scg.golfcanada.ca/uploads/facility/Photo/21751_CabotCliffs.jpg",
              tee_time_url: "https://www.cabotlinks.com/make-a-reservation/",
            },
          },
        ],
      },
      "Cabot Cliffs",
    );
    expect(media.photoUrl).toContain("/Photo/");
    expect(media.websiteUrl).toBe("https://www.cabotlinks.com/");
  });
});

describe("book or call", () => {
  it("keeps a Golf Canada tee-time URL and a Canadian phone", () => {
    expect(canadianPhone("(902) 466-7688")).toBe("(902) 466-7688");
    expect(canadianPhone("1-902-435-3278")).toBe("(902) 435-3278");
    expect(canadianPhone("123")).toBeNull();
    const contact = golfContact(
      {
        data: {
          facilityName: "Eaglequest Grandview",
          url: null,
          teeTimeUrl: "https://secure.east.prophetservices.com/EaglequestGrandviewV3/Home/WidgetView",
          greenFeeUrl: null,
          phone: "(902) 435-3278",
        },
      },
      "Eaglequest Grandview",
    );
    expect(contact?.bookingUrl).toContain("prophetservices.com");
    expect(contact?.phone).toBe("(902) 435-3278");
    const feesOnly = golfContact(
      {
        data: {
          facilityName: "Brightwood Golf Club",
          url: null,
          teeTimeUrl: null,
          greenFeeUrl: "https://www.brightwoodgolf.ca/golf/green-fees/",
          phone: "(902) 466-7688",
        },
      },
      "Brightwood Golf Club",
    );
    expect(feesOnly?.bookingUrl).toBeNull();
    expect(feesOnly?.websiteUrl).toBe("https://www.brightwoodgolf.ca/");
    expect(feesOnly?.phone).toBe("(902) 466-7688");
  });

  it("reads a tee sheet and a tel link from a page, and ignores a fees page", () => {
    const page = parseClubPage(
      `<a href="https://www.brightwoodgolf.ca/golf/green-fees/">Fees</a>
       <a href="tel:(902) 466-7688">Call</a>
       <a href="/contact">Contact</a>`,
      "https://www.brightwoodgolf.ca/",
    );
    expect(page.bookingUrl).toBeNull();
    expect(page.phone).toBe("(902) 466-7688");
    expect(parseClubPage("<p>Pro shop 902-555-0199</p>", "https://example.com/").phone).toBe("(902) 555-0199");
    expect(page.followUrl).toBe("https://www.brightwoodgolf.ca/contact");

    const booked = parseClubPage(
      `<a href="https://www.chronogolf.com/club/example">Book</a>`,
      "https://example.com/",
    );
    expect(booked.bookingUrl).toBe("https://www.chronogolf.com/club/example");
  });

  it("drops the phone and the booking link for a private course, and hides them until the switch is on", () => {
    expect(reachForAccess("private", { bookingUrl: "https://www.chronogolf.com/club/x", phone: "(902) 466-7688" })).toEqual({
      bookingUrl: null,
      phone: null,
    });
    const reach = { bookingUrl: null, phone: "(902) 466-7688", enabled: true };
    expect(shownReach("public", reach, false)).toEqual({ bookingUrl: null, phone: null });
    expect(shownReach("public", { ...reach, enabled: false }, true)).toEqual({ bookingUrl: null, phone: null });
    expect(shownReach("private", reach, true)).toEqual({ bookingUrl: null, phone: null });
    expect(shownReach("public", reach, true)).toEqual({ bookingUrl: null, phone: "(902) 466-7688" });
    expect(
      shownReach("public", { bookingUrl: "https://www.chronogolf.com/club/x", phone: "(902) 466-7688", enabled: true }, true),
    ).toEqual({ bookingUrl: "https://www.chronogolf.com/club/x", phone: null });
  });
});
