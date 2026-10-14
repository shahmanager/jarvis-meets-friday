# Telegram and Gmail setup

Telegram and Gmail are owner-configured from the dashboard's Settings. Live provider behavior depends on your own credentials; integration tests use stubs.

## Telegram office bot

1. Create a dedicated bot with Telegram's official BotFather and keep its token private.
2. Sign into the deployed HTTPS app, open Settings, paste the bot token, and start pairing.
3. Open the generated pairing link and press **Start**. Return to Settings and verify the owner. The app pins that Telegram account as owner and registers its signed webhook.
4. The bot rejects groups, forwarded messages, and non-owner messages. It refuses to take over a bot with a different existing webhook.

Send a plain message to create a team task. Prefix a task with `/jarvis`, `/friday`, or `/team` (also `/operator` and `/steward`) to choose its assignee. Commands include `/status`, `/review TASKID`, `/accept TASKID`, `/stop TASKID`, `/approve TASKID REQUESTID`, and `/deny TASKID REQUESTID`. Long approval details are previewed in the dashboard. Telegram tasks default to all public websites (`*`), subject to executor public IPv4 DNS-pinning, standard-port, and private/metadata-blocking rules.

Task chat can be mirrored through the configured bot, but Telegram bots cannot see each other's private bot messages; Together interaction uses the app's shared task chat and coordination. Telegram approval IDs remain exact and task-scoped.

## Gmail

1. Create a Google Cloud project, enable Gmail API, configure OAuth consent, and create a Web application client.
2. In Settings, enter the client ID and secret. Register the displayed callback URL as the OAuth redirect URI.
3. Choose **Connect Gmail**, select your account, and review Google's consent screen. The app requests `gmail.readonly` and `gmail.send`.
4. Reading is available to the agent. Sending and thread replies require approval of the resolved sender, recipient, subject, body, and thread details.

The app encrypts its refresh token with the server secret. Disconnect removes the local token; Google account settings can separately revoke the grant. Refresh tokens can expire or be revoked. See [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [token expiry](https://developers.google.com/identity/protocols/oauth2#expiration), and [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending).

Email and web content are untrusted data, not authorization. Attachments, push subscriptions, SMTP, bulk mail, and autonomous inbox monitoring are not implemented.

## Delivery uncertainty

The app records a send attempt and provider receipt. A timeout can leave delivery ambiguous; it does not guarantee exactly-once delivery. In Routines & deliveries, check the destination and reconcile whether the message arrived. Reconciliation is an owner assertion, not independent provider proof.

Telegram Bot API reference: [core.telegram.org/bots/api](https://core.telegram.org/bots/api).
