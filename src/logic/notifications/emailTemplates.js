// emailTemplates.ts

/**
 * Email templates for the Delyx Gaming Platform.
 */

export const templates = {
  WELCOME_EMAIL: ({ firstName, profileLink }) => ({
    subject: `Welcome to Delyx 🎮 Your gaming community awaits!`,
    body: `
Hi ${firstName},

Welcome to Delyx – where gamers connect, compete, and thrive.

You can now:
• Join tournaments and find matches
• Connect with friends and fellow gamers
• Trade or sell gaming items in the marketplace
• Join or create groups/clans to play together

👉 Start by completing your profile so others can find you: ${profileLink}
    `,
  }),

  PROFILE_REMINDER: ({ firstName, profileLink }) => ({
    subject: `Complete your Delyx profile ⚡`,
    body: `
Hi ${firstName},

Your profile is almost ready! A complete profile helps you:
• Get more match invites
• Find tournaments suited to your skill level
• Join groups and clans more easily

👉 Finish your profile: ${profileLink}
    `,
  }),

  NEW_CONNECTION_REQUEST: ({ firstName, senderName }) => ({
    subject: `${senderName} wants to connect on Delyx 🤝`,
    body: `
Hi ${firstName},

${senderName} has sent you a friend request. Connect now to play together and chat!

Open the app to accept or decline.
    `,
  }),

  CONNECTION_ACCEPTED: ({ firstName, senderName }) => ({
    subject: `${senderName} accepted your friend request 🎉`,
    body: `
Hi ${firstName},

${senderName} just accepted your friend request. Time to team up or start chatting!
    `,
  }),

  NEW_MATCH: ({ firstName, opponentName, matchLink, scheduledAt }) => ({
    subject: `New Match Alert: ${opponentName} 🕹️`,
    body: `
Hi ${firstName},

You have a new match scheduled against ${opponentName}.
Date & Time: ${scheduledAt}

👉 View match details and confirm: ${matchLink}
    `,
  }),

  GROUP_CREATED: ({ firstName, groupName, groupLink }) => ({
    subject: `Your group "${groupName}" is ready! 🎉`,
    body: `
      Hi ${firstName},
      You successfully created the group "${groupName}".
      Invite members using your group link and start building your community!
      👉 ${groupLink}
    `,
  }),

  MEMBER_JOINED: ({ firstName, groupName, joinerName }) => ({
    subject: `${joinerName} joined "${groupName}" 🕹️`,
    body: `
      Hi ${firstName},
      ${joinerName} just joined your group "${groupName}".
      Say hello and start collaborating!
    `,
  }),

  MEMBER_REMOVED: ({ firstName, groupName }) => ({
    subject: `You have been removed from "${groupName}" ⚠️`,
    body: `
      Hi ${firstName},
      You have been removed from the group "${groupName}" by an admin.
      Contact the admin if you think this was a mistake.
    `,
  }),

  MEMBER_ROLE_CHANGED: ({ firstName, groupName, newRole }) => ({
    subject: `Your role changed in "${groupName}"`,
    body: `
      Hi ${firstName},
      Your role in "${groupName}" has been updated.
      You are now a "${newRole}".
    `,
  }),



  MATCH_RESULT: ({ firstName, opponentName, result, score }) => ({
    subject: `Match Result: ${result} vs ${opponentName} 🏆`,
    body: `
Hi ${firstName},

Your recent match against ${opponentName} has finished.
Result: ${result}
Score: ${score}

Check the leaderboard and see where you rank!
    `,
  }),

  NEW_ITEM: ({ firstName, itemName, itemLink }) => ({
    subject: `New item listed in Delyx Store: ${itemName} 🛒`,
    body: `
Hi ${firstName},

A new item was posted in the Delyx marketplace: ${itemName}.

👉 View item and trade: ${itemLink}
    `,
  }),

  GROUP_INVITE: ({ firstName, groupName, inviterName, groupLink }) => ({
    subject: `You were invited to join ${groupName} 🎯`,
    body: `
Hi ${firstName},

${inviterName} has invited you to join the group/clan: ${groupName}.

👉 Join now: ${groupLink}
    `,
  }),

  PREMIUM_UPGRADE: ({ firstName, planName }) => ({
    subject: `You're now a ${planName} member 🚀`,
    body: `
Hi ${firstName},

Welcome to Delyx ${planName}! You now have access to premium features such as:
• Exclusive tournaments
• Advanced matchmaking filters
• Increased visibility in groups and leaderboards

Enjoy your upgraded experience!
    `,
  }),

  PASSWORD_CHANGED: ({ firstName }) => ({
    subject: `Your Delyx password was changed 🔐`,
    body: `
Hi ${firstName},

Your password has been updated. If you did not make this change, reset your password immediately.
    `,
  }),

  PASSWORD_RESET_REQUESTED: ({ firstName, resetLink }) => ({
    subject: `Reset your Delyx password 🔑`,
    body: `
Hi ${firstName},

We received a request to reset your password.

👉 Reset now: ${resetLink}

If you did not request this, ignore this email.
    `,
  }),

  ACCOUNT_DELETED: ({ firstName }) => ({
    subject: `Your Delyx account has been deleted 🗑️`,
    body: `
Hi ${firstName},

Your account has been deleted. You have 24 hours to restore it before permanent removal.
If this wasn’t you, please contact support immediately.
    `,
  }),

  ACCOUNT_REACTIVATED: ({ firstName }) => ({
    subject: `Welcome back to Delyx 🎉`,
    body: `
Hi ${firstName},

Your account has been successfully reactivated.
You can now continue connecting, competing, and trading in the Delyx community!
    `,
  }),
};

/**
 * Fetches an email template for a specific notification type.
 */
export const getEmailTemplate = (type, payload) => {
  const builder = templates[type];
  if (!builder) throw new Error(`No template for type ${type}`);
  return builder(payload);
};
