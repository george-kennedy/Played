import { describe, expect, it } from "vitest";
import { mediaFromDetail, mediaFromSearch, photoUrl } from "./course-media";

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
