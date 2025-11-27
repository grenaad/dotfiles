#!/Users/adamhiggins/.bun/bin/bun

// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title dev-jwt
// @raycast.mode silent

// Optional parameters:
// @raycast.icon 🤖

import { $ } from "bun";

const req = await fetch("https://rest.focaldata.dev/v1/dashboard/api/v1.0/login", {
  headers: {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "content-type": "application/json",
    cookie:
      "fd_preferred_app=ImRhc2hib2FyZCI%3D; _ugeuid=f536242e-e15e-4a6e-b7fd-03f220414572; amp_4fb5a3=Ul-dT_lblpRejYIaQgPMP8.YWRhbUBmb2NhbGRhdGEuY29t..1if8sc0h3.1if8scv82.0.2.2; refresh_token=v1.M--9NL8EJzEBGrxxgzgBQU9Sbds5qh9M8FYZZJ8vUeGVZXJ7i599_GCTg9HNpKs6I_wZRAN0PV3ABHYRLwks4So; fd_access_token=ImV5SmhiR2NpT2lKU1V6STFOaUlzSW5SNWNDSTZJa3BYVkNJc0ltdHBaQ0k2SWxFd1NUQk9lbGw2VWtSU1JWSkVRWGhPYTA1SFVXcG5NbEpGVFhoTlJFRjVVa1JOZDAwd1NUUlNSRWt4VWxSSmVWSkVhRVpSZHlKOS5leUpvZEhSd2N6b3ZMMmR5WVhCb2NXd3VabTlqWVd4a1lYUmhMbU52YlM5elkyOXdaWE1pT2lKeVpXRmtPbU4xY25KbGJuUmZkWE5sY2lJc0ltbHpjeUk2SW1oMGRIQnpPaTh2Wm05allXeGtZWFJoTG1WMUxtRjFkR2d3TG1OdmJTOGlMQ0p6ZFdJaU9pSmhkWFJvTUh3Mk56STRaalUyTlRVMU5EZ3pZemxsTW1ZM09XSXlOVGtpTENKaGRXUWlPaUpvZEhSd2N6b3ZMMlp2WTJGc1pHRjBZUzVsZFM1aGRYUm9NQzVqYjIwdllYQnBMM1l5THlJc0ltbGhkQ0k2TVRjek5ETTVNVEkyT1N3aVpYaHdJam94TnpNME5EYzNOalk1TENKelkyOXdaU0k2SW5KbFlXUTZZM1Z5Y21WdWRGOTFjMlZ5SUhWd1pHRjBaVHBqZFhKeVpXNTBYM1Z6WlhKZmJXVjBZV1JoZEdFZ1pHVnNaWFJsT21OMWNuSmxiblJmZFhObGNsOXRaWFJoWkdGMFlTQmpjbVZoZEdVNlkzVnljbVZ1ZEY5MWMyVnlYMjFsZEdGa1lYUmhJR055WldGMFpUcGpkWEp5Wlc1MFgzVnpaWEpmWkdWMmFXTmxYMk55WldSbGJuUnBZV3h6SUdSbGJHVjBaVHBqZFhKeVpXNTBYM1Z6WlhKZlpHVjJhV05sWDJOeVpXUmxiblJwWVd4eklIVndaR0YwWlRwamRYSnlaVzUwWDNWelpYSmZhV1JsYm5ScGRHbGxjeUJ2Wm1ac2FXNWxYMkZqWTJWemN5SXNJbWQwZVNJNld5SnlaV1p5WlhOb1gzUnZhMlZ1SWl3aWNHRnpjM2R2Y21RaVhTd2lZWHB3SWpvaVduSkdaR2Q2VmtSeGFITnNORUpUZUVwa1JWTkVabkkyVDJsQmVWbEhSRUVpZlEuaXVzaFdabjhfX2RUNWxWQXFaZFVSY1hmZGxFR0dyN0lIUHFacGhkRFlISmNpVWRpbzY5R0JiUUE5WWF1bEJ6QXZ0VnotWklOQXdhRlNTSE1sQWFseUlTeWl1ODlkWDdXLVV0YnB1WGJwcXFVYnpkMWxqS3hnVk5xUThMR1BXVXZSOFBHQ1hEZ2xqYTcwdkZpNGp4Z0J3dEN1VUI3VUtsSG4zT1N5SVhESzFJTGVXbWJidXdfa1YyVTdGNUczU2M1b3gwOXg2TTM2bzlkZjVWM25xUEJCMUp3TjRTUXRBTzRBdF95NUNiMnpzbEtKWmh0U3ZTVDkyOUgtWmszcHdqaGt0bFNSMlN1eUNRdHJNSnphRnk1dXFoQmpLdWQyU2pxSDcxaXVubVRXczRlTjJzVTZwQjVtckJoUER5YVlUZW1KZW5DT3pqYnFibGlDalAyNWswM3VBIg%3D%3D",
    origin: "https://dashboard.focaldata.dev",
    priority: "u=1, i",
    referer: "https://dashboard.focaldata.dev/",
    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
  body: '{"emailAddress":"[USERNAME]","password":"[PASSWORD]"}',
  method: "POST",
});

const data = await req.json();
await $`echo ${data.accessToken} | pbcopy`;
