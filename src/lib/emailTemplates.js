// emailTemplates.js

export const templates = {
  // =========================
  // AUTH
  // =========================

  OTP_EMAIL: ({ firstName, code }) => ({
    from: process.env.RESEND_FROM_EMAIL || "Delyx <support@delyx.gg>",
    subject: `Your Delyx verification code: ${code}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0f0f0f;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f0f0f; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; border-radius: 12px; border: 1px solid #2a2a4a; box-shadow: 0 4px 24px rgba(0,0,0,0.4);">
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; letter-spacing: 2px;">🎮 DELYX</h1>
              <p style="color: #c4b5fd; margin: 8px 0 0 0; font-size: 14px;">Where Gamers Compete & Connect</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #ffffff; margin: 0 0 16px 0;">Hey ${firstName}! 👋</h2>
              <p style="color: #a0a0b0; margin: 0 0 30px 0; font-size: 16px;">
                Use the code below to verify your email and get into the game.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color: #0f0f23; border: 2px solid #7c3aed; border-radius: 8px; padding: 30px;">
                    <div style="font-size: 44px; font-weight: 700; letter-spacing: 10px; color: #a78bfa; font-family: monospace;">
                      ${code}
                    </div>
                  </td>
                </tr>
              </table>
              <p style="color: #a0a0b0; margin: 24px 0 8px 0; font-size: 14px;">⏰ This code expires in <strong style="color: #ffffff;">10 minutes</strong>.</p>
              <p style="color: #a0a0b0; margin: 0; font-size: 14px;">🔒 Never share this code with anyone.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0f0f23; padding: 24px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="color: #555570; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} Delyx Gaming Platform. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `Hey ${firstName}! Your Delyx verification code is: ${code}. This code expires in 10 minutes.`,
  }),

  WELCOME_EMAIL: ({ firstName }) => ({
    subject: `Welcome to Delyx 🎮 Your gaming community awaits!`,
    body: `
Hey ${firstName},

Welcome to Delyx – where gamers connect, compete, and thrive. 🏆

You can now:
• Join tournaments and find matches
• Connect with friends and fellow gamers
• Trade or sell gaming items in the marketplace
• Join or create groups/clans to play together

👉 Start by completing your profile so others can find you!
    `,
  }),

  PROFILE_REMINDER: ({ firstName }) => ({
    subject: `Level up your profile, ${firstName} ⚡`,
    body: `
Hey ${firstName},

Gamers with complete profiles get more match invites, tournament spots, and group invites.

Add your games, skill level, and a profile picture to stand out.

👉 Finish your profile and get discovered!
    `,
  }),

  PASSWORD_CHANGED: ({ firstName }) => ({
    subject: `Your Delyx password was changed 🔐`,
    body: `
Hey ${firstName},

Your password has been successfully updated.

If you did not make this change, reset your password immediately and contact support.
    `,
  }),

  PASSWORD_RESET_REQUESTED: ({ firstName, resetLink }) => ({
    subject: `Reset your Delyx password 🔑`,
    body: `
Hey ${firstName},

We received a request to reset your Delyx password.

👉 Reset now: ${resetLink}

This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
    `,
  }),

  // =========================
  // ACCOUNT LIFECYCLE
  // =========================

  ACCOUNT_DELETED: ({ firstName }) => ({
    subject: `Your Delyx account has been deleted 🗑️`,
    body: `
Hey ${firstName},

Your account has been deleted. You have 24 hours to restore it before it's permanently removed.

If this wasn't you, contact support immediately.
    `,
  }),

  ACCOUNT_REACTIVATED: ({ firstName }) => ({
    subject: `Welcome back to Delyx 🎉`,
    body: `
Hey ${firstName},

Your Delyx account has been successfully reactivated!

You can now continue connecting, competing, and trading. The leaderboard missed you.
    `,
  }),

  // =========================
  // GROUPS / COMMUNITY
  // =========================

  GROUP_CREATED: ({ firstName, groupName, groupLink }) => ({
    subject: `Your group "${groupName}" is live! 🎉`,
    body: `
Hey ${firstName},

Your group "${groupName}" has been successfully created — you're officially the admin. 🛡️

Invite your crew, set up tournaments, and start building your community.

👉 View your group: ${groupLink}
    `,
  }),

  MEMBER_JOINED: ({ firstName, groupName, joinerName }) => ({
    subject: `${joinerName} just joined "${groupName}" 🕹️`,
    body: `
Hey ${firstName},

${joinerName} just joined your group "${groupName}".

Say hello and get them in the game!
    `,
  }),

  MEMBER_REMOVED: ({ firstName, groupName }) => ({
    subject: `You've been removed from "${groupName}" ⚠️`,
    body: `
Hey ${firstName},

You have been removed from the group "${groupName}" by an admin.

If you think this was a mistake, reach out to the group admin directly.
    `,
  }),

  MEMBER_ROLE_CHANGED: ({ firstName, groupName, newRole }) => ({
    subject: `Your role in "${groupName}" has been updated`,
    body: `
Hey ${firstName},

Your role in the group "${groupName}" has been updated.

You are now a: ${newRole} 🎖️

Check your group to see what's changed.
    `,
  }),

  JOIN_REQUEST_RECEIVED: ({ firstName, groupName, requesterName }) => ({
    subject: `${requesterName} wants to join "${groupName}" 📩`,
    body: `
Hey ${firstName},

${requesterName} has requested to join your group "${groupName}".

👉 Head to your group to approve or reject the request.
    `,
  }),

  JOIN_REQUEST_APPROVED: ({ firstName, groupName, groupLink }) => ({
    subject: `You're in! Your request to join "${groupName}" was approved ✅`,
    body: `
Hey ${firstName},

Great news — your request to join "${groupName}" has been approved!

You're now a member. Jump in and start connecting with your new crew.

👉 View the group: ${groupLink}
    `,
  }),

  JOIN_REQUEST_REJECTED: ({ firstName, groupName }) => ({
    subject: `Your request to join "${groupName}" was not approved`,
    body: `
Hey ${firstName},

Unfortunately your request to join "${groupName}" was not approved by the admin.

You can explore and request to join other groups on Delyx.
    `,
  }),

  GROUP_INVITE: ({ firstName, groupName, inviterName, groupLink }) => ({
    subject: `${inviterName} invited you to join ${groupName} 🎯`,
    body: `
Hey ${firstName},

${inviterName} has invited you to join the group: ${groupName}.

👉 Accept the invite: ${groupLink}
    `,
  }),

  // =========================
  // CONNECTIONS / BUDDIES
  // =========================

  NEW_CONNECTION_REQUEST: ({ firstName, senderName }) => ({
    subject: `${senderName} wants to connect on Delyx 🤝`,
    body: `
Hey ${firstName},

${senderName} sent you a friend request on Delyx.

Accept now to team up, chat, and compete together!
    `,
  }),

  CONNECTION_ACCEPTED: ({ firstName, senderName }) => ({
    subject: `${senderName} accepted your friend request 🎉`,
    body: `
Hey ${firstName},

${senderName} just accepted your friend request. You're now connected!

Time to team up or challenge each other to a match. 🕹️
    `,
  }),

  // =========================
  // MATCHES
  // =========================

  MATCH_CREATED: ({ firstName, opponentName, matchLink, scheduledAt }) => ({
    subject: `Match scheduled vs ${opponentName} 🕹️`,
    body: `
Hey ${firstName},

You have a new match scheduled against ${opponentName}.

📅 Date & Time: ${scheduledAt}

👉 View match details: ${matchLink}
    `,
  }),

  MATCH_FOUND: ({ firstName, opponentName, matchLink }) => ({
    subject: `Match found! You vs ${opponentName} ⚔️`,
    body: `
Hey ${firstName},

A match has been found for you — you're up against ${opponentName}!

👉 View match: ${matchLink}
    `,
  }),

  // =========================
  // MARKETPLACE
  // =========================

  NEW_ITEM: ({ firstName, itemName, itemLink }) => ({
    subject: `New item in the Delyx Store: ${itemName} 🛒`,
    body: `
Hey ${firstName},

A new item has been listed in the Delyx marketplace: ${itemName}.

👉 View and trade: ${itemLink}
    `,
  }),

  // =========================
  // PREMIUM / UPGRADES
  // =========================

  PREMIUM_UPGRADE: ({ firstName, planName }) => ({
    subject: `You're now on Delyx ${planName} 🚀`,
    body: `
Hey ${firstName},

Welcome to Delyx ${planName}! 🎖️

You now have access to:
• Exclusive tournaments
• Advanced matchmaking filters
• Increased visibility in groups and leaderboards

Let's go — the leaderboard is waiting.
    `,
  }),
};

/**
 * Fetches an email template for a specific notification type.
 */
export const getEmailTemplate = (type, payload) => {
  const builder = templates[type];
  if (!builder) throw new Error(`No email template found for type: ${type}`);
  return builder(payload);
};
