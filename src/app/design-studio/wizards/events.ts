// SA event roster. Drives the Event one-pager wizard pre-fill. Add to
// this list whenever a new conference shows up on the calendar.

export interface EventEntry {
  id: string;
  label: string;
  sub: string;       // location + month so the picker can show context
  category: string;  // free-form, e.g. "AI/ML", "Semi", "Cloud", "Hardware"
  logoUrl?: string;  // optional — public/images/events/*
}

export const EVENT_ROSTER: EventEntry[] = [
  { id: "aws-reinvent",       label: "AWS re:Invent",       sub: "Las Vegas · December",   category: "Cloud",     logoUrl: "/images/events/aws.svg" },
  { id: "mlsys",              label: "MLSys",               sub: "Santa Clara · May",      category: "AI/ML",     logoUrl: "/images/events/mlsys.svg" },
  { id: "neurips",            label: "NeurIPS",             sub: "Vancouver · December",   category: "AI/ML",     logoUrl: "/images/events/neurips.svg" },
  { id: "icml",               label: "ICML",                sub: "Vienna · July",          category: "AI/ML",     logoUrl: "/images/events/icml.svg" },
  { id: "colm",               label: "COLM",                sub: "Philadelphia · October", category: "AI/ML",     logoUrl: "/images/events/colm.svg" },
  { id: "raise",              label: "RAISE Summit",        sub: "Paris · July",           category: "AI/ML",     logoUrl: "/images/events/raise.svg" },
  { id: "computex",           label: "Computex",            sub: "Taipei · May / June",    category: "Hardware",  logoUrl: "/images/events/computex.svg" },
  { id: "ocp",                label: "OCP Global Summit",   sub: "San Jose · October",     category: "Hardware",  logoUrl: "/images/events/ocp.jpg" },
  { id: "yotta",              label: "YottaDB / Yotta",     sub: "TBD",                    category: "Infra",     logoUrl: "/images/events/yotta.png" },
  { id: "sa-internal",        label: "SemiAnalysis event",  sub: "TBD",                    category: "Internal",  logoUrl: "/images/events/semianalysis.png" },
];

export function findEvent(id: string | null | undefined): EventEntry | undefined {
  if (!id) return undefined;
  return EVENT_ROSTER.find((e) => e.id === id);
}
