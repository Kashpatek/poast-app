import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateJSON, AnthropicError } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/ratelimit";

const FkSchema = z.object({
  action: z.enum(["briefing", "prepkit", "process", "cold-email", "generate-bio"]),
}).passthrough();

const FK_SYS = `You are a podcast production assistant for Fabricated Knowledge, an audio interview podcast by Doug O'Laughlin at SemiAnalysis. You help with pre-interview research, briefing docs, and post-production content.

Rules:
- Never use em dashes. Use commas, periods, or colons.
- No emojis.
- Be direct and technical.
- SemiAnalysis covers semiconductors, AI infrastructure, data centers, memory, compute, and geopolitics.
- Doug's style: deep technical, conversational, focused on first principles.

You MUST respond ONLY with valid JSON. No markdown fences. No preamble.`;

export async function POST(req: NextRequest) {
  try {
    const { allowed, remaining } = await checkRateLimit(req);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining ?? 0) } }
      );
    }

    const body = await req.json();
    const parsed = FkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { action } = body;

    if (action === "briefing") {
      const { guestName, guestCompany, guestRole, guestTopics } = body;
      try {
        const briefing = await generateJSON({
          system: FK_SYS,
          maxTokens: 3000,
          prompt: `Generate a pre-interview briefing document for Doug O'Laughlin.

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
}`,
        });
        return NextResponse.json({ briefing, ts: Date.now() });
      } catch (e) {
        if ((e as AnthropicError).status) {
          return NextResponse.json({ error: (e as Error).message || "Failed" }, { status: (e as AnthropicError).status });
        }
        if (e instanceof SyntaxError) {
          return NextResponse.json({ error: "Failed to parse briefing", raw: String(e).slice(0, 300) }, { status: 500 });
        }
        throw e;
      }
    }

    if (action === "prepkit") {
      const { guestName, guestCompany, episodeTopic } = body;
      try {
        const prepkit = await generateJSON({
          system: FK_SYS,
          maxTokens: 2000,
          prompt: `Generate a guest prep kit one-pager for an upcoming Fabricated Knowledge episode.

Guest: ${guestName} at ${guestCompany}
Topic: ${episodeTopic}

Return JSON:
{
  "show_overview": "Brief description of Fabricated Knowledge for the guest",
  "what_to_expect": "Format, duration, style notes for the guest",
  "topic_outline": "High-level outline of what will be discussed",
  "logistics": "Recording setup notes (Riverside, audio-only, 45-60 min)"
}`,
        });
        return NextResponse.json({ prepkit, ts: Date.now() });
      } catch (e) {
        if ((e as AnthropicError).status) {
          return NextResponse.json({ error: (e as Error).message || "Failed" }, { status: (e as AnthropicError).status });
        }
        if (e instanceof SyntaxError) {
          return NextResponse.json({ error: "Failed to parse prep kit" }, { status: 500 });
        }
        throw e;
      }
    }

    if (action === "process") {
      const { transcript, guestName, episodeTopic } = body;
      try {
        const processed = await generateJSON({
          system: FK_SYS,
          maxTokens: 4000,
          prompt: `Process this podcast transcript for Fabricated Knowledge.

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
}`,
        });
        return NextResponse.json({ processed, ts: Date.now() });
      } catch (e) {
        if ((e as AnthropicError).status) {
          return NextResponse.json({ error: (e as Error).message || "Failed" }, { status: (e as AnthropicError).status });
        }
        if (e instanceof SyntaxError) {
          return NextResponse.json({ error: "Failed to parse transcript processing" }, { status: 500 });
        }
        throw e;
      }
    }

    if (action === "cold-email") {
      const { guestName, guestCompany, guestRole, guestTopics } = body;
      try {
        const email = await generateJSON({
          system: FK_SYS,
          maxTokens: 1500,
          prompt: `Generate a personalized cold outreach email from Doug O'Laughlin to a potential podcast guest for Fabricated Knowledge.

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
}`,
        });
        return NextResponse.json({ email, ts: Date.now() });
      } catch (e) {
        if ((e as AnthropicError).status) {
          return NextResponse.json({ error: (e as Error).message || "Failed" }, { status: (e as AnthropicError).status });
        }
        if (e instanceof SyntaxError) {
          return NextResponse.json({ error: "Failed to parse email", raw: String(e).slice(0, 300) }, { status: 500 });
        }
        throw e;
      }
    }

    if (action === "generate-bio") {
      const { guestName, guestCompany, guestRole, guestTopics } = body;
      try {
        const parsed = await generateJSON<{ bio: string }>({
          system: FK_SYS,
          maxTokens: 500,
          prompt: `Write a brief 2-3 sentence professional bio for a potential Fabricated Knowledge podcast guest.

Name: ${guestName}
Company: ${guestCompany}
Role: ${guestRole}
Topic Areas: ${guestTopics}

The bio should highlight their role, company, and area of expertise relevant to semiconductors, AI infrastructure, or related fields.

Return JSON:
{
  "bio": "the 2-3 sentence bio"
}`,
        });
        return NextResponse.json({ bio: parsed.bio, ts: Date.now() });
      } catch (e) {
        if ((e as AnthropicError).status) {
          return NextResponse.json({ error: (e as Error).message || "Failed" }, { status: (e as AnthropicError).status });
        }
        if (e instanceof SyntaxError) {
          return NextResponse.json({ error: "Failed to parse bio" }, { status: 500 });
        }
        throw e;
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "ANTHROPIC_API_KEY not configured") {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
