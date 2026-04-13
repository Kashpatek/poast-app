import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const clientId = process.env.BUFFER_CLIENT_ID;
  const clientSecret = process.env.BUFFER_CLIENT_SECRET;
  const redirectUri = process.env.BUFFER_REDIRECT_URI;

  if (!code || !clientId || !clientSecret || !redirectUri) {
    return new NextResponse(
      "<html><body style='background:#06060E;color:#E8E6F0;font-family:monospace;padding:40px'>" +
      "<h2>Buffer OAuth Error</h2><p>Missing code or env vars (BUFFER_CLIENT_ID, BUFFER_CLIENT_SECRET, BUFFER_REDIRECT_URI).</p>" +
      "</body></html>",
      { headers: { "Content-Type": "text/html" } }
    );
  }

  try {
    // Exchange code for access token
    const r = await fetch("https://api.bufferapp.com/1/oauth2/token.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code,
        grant_type: "authorization_code",
      }),
    });

    const data = await r.json();

    if (data.access_token) {
      // Show the token so user can add it to Vercel
      return new NextResponse(
        "<html><body style='background:#06060E;color:#E8E6F0;font-family:monospace;padding:40px;max-width:600px;margin:0 auto'>" +
        "<h2 style='color:#7C5CFC'>Buffer Connected!</h2>" +
        "<p style='color:#8B88A0;line-height:1.8'>Your access token has been generated. Add it to Vercel:</p>" +
        "<div style='background:#101020;border:1px solid #161625;border-radius:8px;padding:16px;margin:16px 0'>" +
        "<div style='color:#8B88A0;font-size:11px;margin-bottom:8px'>BUFFER_ACCESS_TOKEN</div>" +
        "<div style='color:#00D4AA;font-size:14px;word-break:break-all;user-select:all'>" + data.access_token + "</div>" +
        "</div>" +
        "<p style='color:#8B88A0;font-size:12px;line-height:1.8'>1. Copy the token above<br>2. Go to Vercel > poast-app > Settings > Environment Variables<br>3. Add/update BUFFER_ACCESS_TOKEN with this value<br>4. Redeploy<br>5. The Schedule page will work!</p>" +
        "<a href='/' style='color:#7C5CFC;font-size:13px'>Back to POAST</a>" +
        "</body></html>",
        { headers: { "Content-Type": "text/html" } }
      );
    } else {
      return new NextResponse(
        "<html><body style='background:#06060E;color:#E8E6F0;font-family:monospace;padding:40px'>" +
        "<h2 style='color:#FF6B6B'>Token Exchange Failed</h2>" +
        "<pre style='color:#8B88A0'>" + JSON.stringify(data, null, 2) + "</pre>" +
        "<a href='/' style='color:#7C5CFC'>Back to POAST</a>" +
        "</body></html>",
        { headers: { "Content-Type": "text/html" } }
      );
    }
  } catch (error) {
    return new NextResponse(
      "<html><body style='background:#06060E;color:#FF6B6B;font-family:monospace;padding:40px'>" +
      "<h2>Error</h2><p>" + String(error) + "</p>" +
      "<a href='/' style='color:#7C5CFC'>Back to POAST</a>" +
      "</body></html>",
      { headers: { "Content-Type": "text/html" } }
    );
  }
}
