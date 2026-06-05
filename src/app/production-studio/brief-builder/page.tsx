"use client";
import { useEffect, useState } from "react";
import BriefBuilder from "../brief-builder";

export default function BriefBuilderPage() {
  const [ok, setOk] = useState(false);

  useEffect(function () {
    try {
      const stored = localStorage.getItem("poast-current-user");
      if (stored) {
        setOk(true);
        return;
      }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  if (!ok) return null;

  return <BriefBuilder />;
}
