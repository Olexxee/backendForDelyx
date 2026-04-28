const resolveAvatarUrl = (profilePicture) => {
  if (!profilePicture) return undefined;

  if (typeof profilePicture === "string") {
    return profilePicture;
  }

  if (typeof profilePicture === "object") {
    return (
      profilePicture.url ||
      profilePicture.secureUrl ||
      profilePicture.path ||
      undefined
    );
  }
  return undefined;
};

const resolveMediaUrl = (mediaItem) => {
  if (!mediaItem) return undefined;

  if (typeof mediaItem === "string") {
    return mediaItem;
  }

  if (typeof mediaItem === "object") {
    return mediaItem.url || mediaItem.secureUrl || mediaItem.path || undefined;
  }

  return undefined;
};

const mapPostContext = (post) => {
  if (!post.contextType || post.contextType === "general" || !post.contextId) {
    return undefined;
  }

  return {
    type: post.contextType,
    id: post.contextId.toString(),
    label: "",
  };
};

export const mapPostToPlayerFeedItem = (
  post,
  viewerReactionTargetIds = new Set(),
) => {
  const postId = post._id.toString();

  return {
    id: postId,
    type: "player_post",
    createdAt: post.createdAt,

    author: {
      id: post.author?._id?.toString?.() ?? post.author?.toString?.() ?? "",
      username: post.author?.username ?? "Unknown",
      avatarUrl: resolveAvatarUrl(post.author?.profilePicture),
    },

    text: post.content ?? "",

    media: (post.media || [])
      .map((mediaItem) => {
        const url = resolveMediaUrl(mediaItem);
        if (!url) return null;

        return {
          type: "image",
          url,
        };
      })
      .filter(Boolean),

    context: mapPostContext(post),

    reactionsCount: post.reactionsCount ?? 0,
    commentsCount: post.commentsCount ?? 0,
    viewerHasReacted: viewerReactionTargetIds.has(postId),
  };
};
