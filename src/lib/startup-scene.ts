/* Utah's startup scene beyond the live calendar: the regular meetups and
   the big annual events, shown on /startup-events. Hand-verified against
   each organizer's own page (and our listings) on `lastVerified`; the
   `evidence` notes say what was checked and are not shown on the page.
   Re-check every few months: venues rotate and series stop. Only add
   entries that have been verified the same way. Data shape is tested in
   tests/startup-scene.test.ts (https links, no em dashes). */

export type SceneConfidence = "high" | "medium";

export interface RecurringMeetup {
  name: string;
  cadence: string;
  where: string;
  blurb: string;
  /* The organizer's page (where people RSVP). */
  url: string;
  /* Our /group/<slug> page, when the evidence names one. */
  groupSlug: string | null;
  evidence: string;
  /* YYYY-MM-DD of the latest edition confirmed to have happened. */
  lastConfirmedEventDate: string;
  confidence: SceneConfidence;
}

export interface AnnualEvent {
  name: string;
  when: string;
  where: string;
  blurb: string;
  url: string;
  evidence: string;
  confidence: SceneConfidence;
}

export interface StartupScene {
  /* YYYY-MM-DD the whole list was last checked. */
  lastVerified: string;
  recurring: RecurringMeetup[];
  annual: AnnualEvent[];
}

export const STARTUP_SCENE: StartupScene = {
  lastVerified: "2026-10-26",
  recurring: [
    {
      name: "1 Million Cups Salt Lake City",
      cadence: "Weekly, Wednesdays at 9:00 AM",
      where: "The Neighborhood Hive, 2065 E 2100 S, Sugar House, Salt Lake City",
      blurb: "Free weekly morning meeting where one or two local founders present their company and take questions and feedback from the audience.",
      url: "https://1mcslc.com",
      groupSlug: null,
      evidence: "The chapter site (1mcslc.com) gives the venue as The Neighborhood Hive in Sugar House, Wednesdays at 9 AM. Our calendar has weekly listings from the national 1millioncups.com chapter page, 47 since June 2026, the latest past one on 2026-10-21 and the next on 2026-10-28. Older LinkedIn and state pages name Woodbine downtown as the venue, which looks out of date. There is no /group page on our site (no group_id).",
      lastConfirmedEventDate: "2026-10-21",
      confidence: "high",
    },
    {
      name: "Third Thursday @ Three Startup Pitch Event",
      cadence: "Monthly, third Thursday, 3:00 to 5:00 PM",
      where: "Lehi. The exact address is shown after registration; recent editions have been at Silicon Slopes HQ and Kiln Lehi",
      blurb: "Monthly pitch event hosted by Ray Smithson of Kinect Capital: three to five 3-minute pitches, then networking with founders, mentors and investors.",
      url: "https://luma.com/xdarhaso",
      groupSlug: null,
      evidence: "The Luma listing for (Oct 15) is marked past, and a (Nov 19) listing is up; Oct 15 and Nov 19, 2026 are both third Thursdays. Our calendar has siliconslopes.com and Eventbrite listings for Jun 18, Jul 16, Aug 20 and Oct 15, 2026. The startup.utah.gov/business.utah.gov article describes the third-Thursday format. There is no /group page on our site.",
      lastConfirmedEventDate: "2026-10-15",
      confidence: "high",
    },
    {
      name: "Utah Business Founder Friday",
      cadence: "Monthly, a Friday morning, 9:00 to 11:00 AM",
      where: "Rotating Kiln locations (Lehi, Holladay, Salt Lake City)",
      blurb: "Free monthly interview with a Utah founder, hosted by Utah Business, with seating limited to about 140.",
      url: "https://utahbusiness.com/events/founder-friday",
      groupSlug: null,
      evidence: "utahbusiness.com/events/founder-friday says 'monthly Founder Fridays' and lists Dec 11, 2026 (Lavanya Mahate, Kiln Salt Lake City), plus 2026 sessions with Kickstart (Apr 24, Kiln Holladay), Filevine, Chidester and Capita. Our calendar has the Luma listings for Jul 17, 2026 (Chidester) and Sep 18, 2026 (Mike Littledike, Capita), both at Kiln, 2701 N Thanksgiving Way, Lehi. There is no /group page on our site.",
      lastConfirmedEventDate: "2026-09-18",
      confidence: "high",
    },
    {
      name: "Scale STG Startup Friday",
      cadence: "Monthly, usually the first Friday, 12:00 to 1:00 PM",
      where: "Kiln St. George, 1575 S River Rd, St. George",
      blurb: "Monthly lunchtime meetup from the Scale STG nonprofit: two or three short pitches from local builders, then an open floor and networking with mentors.",
      url: "https://www.meetup.com/scalestg/",
      groupSlug: null,
      evidence: "Our calendar has Meetup (scalestg) listings for Feb 6, Mar 6, Apr 3, Jun 5, Aug 7 and Sep 4, 2026. The Luma page 'Scale STG Startup Friday - November 2026' (luma.com/04yd2z1r, Nov 6) is live and describes the format as 'an hour a month'. There is no /group page on our site.",
      lastConfirmedEventDate: "2026-09-04",
      confidence: "high",
    },
    {
      name: "Silicon Slopes founder and CEO conversations",
      cadence: "Several per month, midday (about noon MT)",
      where: "Silicon Slopes headquarters, Lehi",
      blurb: "Midday talks at Silicon Slopes in which Utah founders and CEOs discuss how they built their companies.",
      url: "https://www.siliconslopes.com/c/events",
      groupSlug: null,
      evidence: "Our calendar holds siliconslopes.com event listings for this series: Nomi Health (Oct 7), Databento CEO Christina Qi (Oct 19) and Sorenson Capital's Fraser Bullock (Oct 26, 2026). Upcoming listings are Traeger (Nov 6), Campfire (Nov 9), BUILT (Nov 16) and Pattern (Dec 7). The Circle-hosted pages would not render for me, so the time and venue come from our listings. I found no official series name. There is no /group page on our site.",
      lastConfirmedEventDate: "2026-10-26",
      confidence: "medium",
    },
    {
      name: "University of Utah Tech Tuesday",
      cadence: "Every two to three months, Tuesday, 5:00 to 7:00 PM",
      where: "University of Utah Technology Licensing Office area, 303 Chipeta Way, Salt Lake City (Research Park)",
      blurb: "Evening networking event, 21 and over, from the University of Utah Technology Licensing Office, connecting researchers, startups, investors and industry partners around commercialization.",
      url: "https://technologylicensing.utah.edu/news-events/tech-tuesday",
      groupSlug: null,
      evidence: "The TLO pages list 2026 editions on Feb 10 (Neurotech Showcase, 303 Chipeta Way), Apr 7, Jul 14 and Sep 15 (AME Lab), with the next on Nov 17, 2026 (Defense Tech Networking). Our calendar has the Sep 15, 2026 edition at 303 Chipeta Way. This is the public event series of the Utah Venture Hub / TLO. There is no /group page on our site.",
      lastConfirmedEventDate: "2026-09-15",
      confidence: "high",
    },
    {
      name: "Women Entrepreneurs of Park City",
      cadence: "Monthly, evening (Aug and Sep 2026 sessions were on the second Wednesday)",
      where: "Kiln Park City, 1090 Center Dr, Park City",
      blurb: "Monthly gathering for women building businesses, with a guest-led education session, hot-seat problem solving and open networking.",
      url: "https://luma.com/8lm1gsqj",
      groupSlug: null,
      evidence: "The Luma pages for the August meeting (luma.com/8lm1gsqj) and September meeting (luma.com/vjbg851m) say 'Each month we gather at Kiln Park City'. Our calendar dates them Aug 12 and Sep 9, 2026, both currently hidden. I found no October listing. There is no /group page on our site.",
      lastConfirmedEventDate: "2026-09-09",
      confidence: "medium",
    },
  ],
  annual: [
    {
      name: "Hard Tech Week",
      when: "First held October 26 to 30, 2026, with 47G's Zero Gravity Summit on Oct 28 to 29. Future dates not announced.",
      where: "Salt Lake City, with events across Utah",
      blurb: "A week of community-hosted events on aerospace, defense, energy, advanced manufacturing and other hard tech, organized by 47G with Utah Tech Week and Silicon Slopes and anchored by 47G's Zero Gravity Summit.",
      url: "https://www.47g.org/hard-tech-week",
      evidence: "The 47g.org/hard-tech-week page gives Oct 26 to 30, 2026 and the Zero Gravity Summit on Oct 28 to 29. TechBuzz News (Aug 26, 2026) calls it Utah's first Hard Tech Week, co-organized by 47G and Utah Tech Week. Our calendar has the hackathon kickoff (Oct 26), the opening party at Traeger HQ (Oct 27) and other week events. 2026 is the inaugural year, so annual recurrence is not yet established.",
      confidence: "high",
    },
    {
      name: "Utah Tech Week",
      when: "Late January or early February (2025: Jan 27 to Feb 1; 2026: Feb 2 to 7). No 2027 dates announced.",
      where: "Salt Lake City and Point of the Mountain (Lehi and Draper area)",
      blurb: "Free, community-run week of events hosted by startups, investors and local organizations; the 2025 edition had more than 220 events.",
      url: "https://www.utahtechweek.com",
      evidence: "Wilson Sonsini's Utah Tech Week 2026 listing gives Feb 2 to 7, 2026; the River case study covers the 2025 edition (Jan 27 to Feb 1, 220+ events). utahtechweek.com currently promotes the Oct 26 to 30, 2026 Hard Tech Week collaboration and says its next calendar drops December 16. Our calendar's 'Utah Tech Week 2027' entry (2027-02-01, 'penciled') is not confirmed by any source.",
      confidence: "medium",
    },
    {
      name: "Silicon Slopes Summit",
      when: "Usually January to March. Next: SUMMIT 2027, March 18 to 19, 2027 (2026 ran Feb 4 to 7).",
      where: "Salt Palace Convention Center, Salt Lake City",
      blurb: "Silicon Slopes' flagship conference for Utah's tech community, with keynotes, breakout sessions and networking.",
      url: "https://siliconslopessummit.org",
      evidence: "siliconslopessummit.org gives SUMMIT 2027 as March 18 to 19, 2027 at the Salt Palace, and the causo.ai listing matches. Visit Salt Lake gives the 2026 edition as Feb 4 to 7, 2026, across downtown venues. Our calendar's 'Silicon Slopes SUMMIT 2027' entry is dated 2027-02-03 ('penciled') and should move to Mar 18 to 19, 2027.",
      confidence: "high",
    },
    {
      name: "StartFEST",
      when: "June (2026: June 23 to 24). Next edition not yet announced.",
      where: "2026: Loveland Living Planet Aquarium, Draper",
      blurb: "Two-day startup festival from Silicon Slopes and Mountain America Credit Union, with talks on building and funding companies, a hackathon and the Utah regional round of the Startup World Cup.",
      url: "https://www.techbuzznews.com/startfest-2026/",
      evidence: "TechBuzz News (Jun 11, 2026) and Silicon Slopes newsletters give Jun 23 to 24, 2026 at Loveland Living Planet Aquarium, Draper, with six tracks and 36 sessions. Our calendar has 'StartFEST 2026' on 2026-06-23 but lists the venue as 'Silicon Slopes'.",
      confidence: "high",
    },
    {
      name: "Tim Draper Utah Entrepreneur Challenge",
      when: "Spring finals (2026: March 28). Next finals: March 20, 2027.",
      where: "University of Utah, Salt Lake City",
      blurb: "Statewide student business competition run by the Lassonde Entrepreneur Institute, with $75,000 in cash and prizes split among the top 20 finalist teams.",
      url: "https://lassonde.utah.edu/uec",
      evidence: "lassonde.utah.edu/uec lists the 2026-2027 final event as March 20, 2027, at the University of Utah. Lassonde's photo gallery gives the 2026 final awards and showcase as March 28, 2026 (an Apr 3 item is the recap video).",
      confidence: "high",
    },
    {
      name: "Lassonde Demo Day",
      when: "Late April or early May (2026: April 29). Next: Wednesday, May 5, 2027, 3:00 to 5:00 PM.",
      where: "Lassonde Studios, 1701 Student Life Way, Salt Lake City",
      blurb: "End-of-year public showcase of University of Utah student startups from the Lassonde Entrepreneur Institute.",
      url: "https://lassonde.utah.edu/demo",
      evidence: "lassonde.utah.edu/demo lists May 5, 2027, 3 to 5 PM at Lassonde Studios and says 'All are welcome to attend'. The Lassonde homepage reported the 2026 Demo Day on April 29, 2026.",
      confidence: "high",
    },
  ],
};
