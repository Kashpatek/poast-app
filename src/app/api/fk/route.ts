import { NextRequest, NextResponse } from "next/server";

const FK_SYS = `You are a podcast production assistant for Fabricated Knowledge, an audio interview podcast by Doug O'Laughlin at SemiAnalysis. You help with pre-interview research, briefing docs, and post-production content.

Rules:
- Never use em dashes. Use commas, periods, or colons.
- No emojis.
- Be direct and technical.
- SemiAnalysis covers semiconductors, AI infrastructure, data centers, memory, compute, and geopolitics.
- Doug's style: deep technical, conversational, focused on first principles.

You MUST respond ONLY with valid JSON. No markdown fences. No preamble.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "briefing") {
      const { guestName, guestCompany, guestRole, guestTopics } = body;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          system: FK_SYS,
          messages: [{ role: "user", content: `Generate a pre-interview briefing document for Doug O'Laughlin.

Guest: ${guestName}
Company: ${guestCompany}
Role: ${guestRole}
Topic Areas: ${guestTopics}

Return JSON:
{
  "guest_bio": "2-3 paragraph bio of the guest and their work",
  "company_context": "what the company does and recent developments",
  "sa_angles": ["list of 4-6 angles relevant to SemiAnalysis research"],
  "talking_points": ["list of 8-10 suggested questions/talking points for Doug"],
  "avoid": ["topics or framings to avoid"],
  "recent_news": ["3-5 recent news items about the guest or their company"]
}` }],
        }),
      });
      const data = await r.json();
      if (!r.ok) return NextResponse.json({ error: data?.error?.message || "Failed" }, { status: r.status });
      const rawText = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
      try {
        const briefing = JSON.parse(rawText.replace(/```json|```/g, "").trim());
        return NextResponse.json({ briefing, ts: Date.now() });
      } catch {
        return NextResponse.json({ error: "Failed to parse briefing", raw: rawText.slice(0, 300) }, { status: 500 });
      }
    }

    if (action === "prepkit") {
      const { guestName, guestCompany, episodeTopic } = body;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: FK_SYS,
          messages: [{ role: "user", content: `Generate a guest prep kit one-pager for an upcoming Fabricated Knowledge episode.

Guest: ${guestName} at ${guestCompany}
Topic: ${episodeTopic}

Return JSON:
{
  "show_overview": "Brief description of Fabricated Knowledge for the guest",
  "what_to_expect": "Format, duration, style notes for the guest",
  "topic_outline": "High-level outline of what will be discussed",
  "logistics": "Recording setup notes (Riverside, audio-only, 45-60 min)"
}` }],
        }),
      });
      const data = await r.json();
      if (!r.ok) return NextResponse.json({ error: data?.error?.message || "Failed" }, { status: r.status });
      const rawText = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
      try {
        const prepkit = JSON.parse(rawText.replace(/```json|```/g, "").trim());
        return NextResponse.json({ prepkit, ts: Date.now() });
      } catch {
        return NextResponse.json({ error: "Failed to parse prep kit" }, { status: 500 });
      }
    }

    if (action === "process") {
      const { transcript, guestName, episodeTopic } = body;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: FK_SYS,
          messages: [{ role: "user", content: `Process this podcast transcript for Fabricated Knowledge.

Guest: ${guestName}
Topic: ${episodeTopic}
Transcript (first 8000 chars): ${(transcript || "").slice(0, 8000)}

Return JSON:
{
  "titles": ["3 episode title options, concise and compelling"],
  "description_long": "Spotify-length episode description (150-250 words)",
  "description_short": "Social media description (1-2 sentences)",
  "chapters": [{ "time": "00:00", "title": "chapter title" }],
  "clips": [{ "timestamp": "approximate time", "quote": "the soundbite text", "context": "why this is a good clip" }]
}` }],
        }),
      });
      const data = await r.json();
      if (!r.ok) return NextResponse.json({ error: data?.error?.message || "Failed" }, { status: r.status });
      const rawText = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
      try {
        const processed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
        return NextResponse.json({ processed, ts: Date.now() });
      } catch {
        return NextResponse.json({ error: "Failed to parse transcript processing" }, { status: 500 });
      }
    }

    if (action === "cold-email") {
      const { guestName, guestCompany, guestRole, guestTopics } = body;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: FK_SYS,
          messages: [{ role: "user", content: `Generate a personalized cold outreach email from Doug O'Laughlin to a potential podcast guest for Fabricated Knowledge.

Guest: ${guestName}
Company: ${guestCompany}
Role: ${guestRole}
Topic Areas: ${guestTopics}

Doug runs SemiAnalysis and hosts Fabricated Knowledge, an audio interview podcast covering semiconductors, AI infrastructure, data centers, memory, compute, and geopolitics.

The email should:
- Be professional but warm
- Introduce Doug and Fabricated Knowledge briefly
- Explain why this guest is a perfect fit
- Reference their recent work or area of expertise
- Mention format: conversational, 45-60 min, audio-only via Riverside
- End with a clear ask

Return JSON:
{
  "subject": "email subject line",
  "body": "full email body text"
}` }],
        }),
      });
      const data = await r.json();
      if (!r.ok) return NextResponse.json({ error: data?.error?.message || "Failed" }, { status: r.status });
      const rawText = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
      try {
        const email = JSON.parse(rawText.replace(/```json|```/g, "").trim());
        return NextResponse.json({ email, ts: Date.now() });
      } catch {
        return NextResponse.json({ error: "Failed to parse email", raw: rawText.slice(0, 300) }, { status: 500 });
      }
    }

    if (action === "generate-bio") {
      const { guestName, guestCompany, guestRole, guestTopics } = body;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system: FK_SYS,
          messages: [{ role: "user", content: `Write a brief 2-3 sentence professional bio for a potential Fabricated Knowledge podcast guest.

Name: ${guestName}
Company: ${guestCompany}
Role: ${guestRole}
Topic Areas: ${guestTopics}

The bio should highlight their role, company, and area of expertise relevant to semiconductors, AI infrastructure, or related fields.

Return JSON:
{
  "bio": "the 2-3 sentence bio"
}` }],
        }),
      });
      const data = await r.json();
      if (!r.ok) return NextResponse.json({ error: data?.error?.message || "Failed" }, { status: r.status });
      const rawText = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
      try {
        const parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
        return NextResponse.json({ bio: parsed.bio, ts: Date.now() });
      } catch {
        return NextResponse.json({ error: "Failed to parse bio" }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
