const mapMediaItem = (mediaItem) => {
  if (!mediaItem) return null;

  return {
    type: "image",
    url: mediaItem.url ?? mediaItem.secureUrl ?? mediaItem.path ?? "",
  };
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

export const mapPostToPlayerFeedItem = (post) => ({
  id: post._id.toString(),
  type: "player_post",
  createdAt: post.createdAt,

  author: {
    id: post.author?._id?.toString(),
    username: post.author?.username ?? "Unknown",
    avatarUrl: post.author?.profilePicture || undefined,
  },

  text: post.content ?? "",

  media: (post.media || [])
    .map(mapMediaItem)
    .filter(Boolean)
    .filter((item) => item.url),

  context: mapPostContext(post),

  reactionsCount: post.reactionsCount ?? 0,
  commentsCount: post.commentsCount ?? 0,
  viewerHasReacted: false,
});
