#!/Users/adamhiggins/.bun/bin/bun

// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title prod-jwt
// @raycast.mode silent

// Optional parameters:
// @raycast.icon 🤖

import { $ } from "bun";

const req = await fetch("https://rest.focaldata.com/v1/dashboard/api/v1.0/login", {
  headers: {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "content-type": "application/json",
    pragma: "no-cache",
    "sec-ch-ua": '"Chromium";v="123", "Not:A-Brand";v="8"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    cookie:
      "_hjSessionUser_2945790=eyJpZCI6ImQ4MzYwNzBiLWVmOTUtNTBmOC05NTcxLWI3YTdhNzc3MDA3NCIsImNyZWF0ZWQiOjE2OTMyOTgwNjg3NTUsImV4aXN0aW5nIjp0cnVlfQ==; ajs_anonymous_id=aafc5714-0525-4eb5-8b62-f6bb1c9a462d; cb_user_id=null; cb_group_id=null; cb_anonymous_id=%22598e1aa7-c031-42df-8374-58da9e2a1140%22; _ga_W71TF5M9M0=GS1.1.1693403776.4.0.1693403776.60.0.0; analytics_session_id=1694453943656; analytics_session_id.last_access=1694453943656; _ga_RV2Y45RZED=GS1.2.1694453953.3.1.1694453953.0.0.0; _ga=GA1.2.575641151.1694538664; _ga_2S8KBMDPVT=GS1.2.1704813890.132.0.1704813890.0.0.0; refresh_token=v1.MzM0b3n0tuMkdG8gSq76wV7kCL7-d1CFeu47CgROUyrwC5LuZNq9FJrjNrHWh_Cnf2NfL0un_xMMgdtTvZCJ7oS32w; amp_090b15=B_TMuBm2IWE1Ubrj4RZBX-.bmF0ZUBmb2NhbGRhdGEuY29t..1hqkvedvv.1hqkvei2i.1.q.r",
    Referer: "https://dashboard.focaldata.com/",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  },
  body: '{"emailAddress":"[USERNAME]","password":"[PASSWORD]"}',
  method: "POST",
});

const data = await req.json();
await $`echo ${data.accessToken} | pbcopy`;
