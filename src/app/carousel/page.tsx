"use client";

// /carousel — retired. CarouselNEU (/carousel-2) is the platform Carousel now;
// this route redirects there so any old link or bookmark lands on the new wizard.

import { useEffect } from "react";

export default function CarouselPage() {
  useEffect(function () {
    window.location.replace("/carousel-2");
  }, []);
  return null;
}
