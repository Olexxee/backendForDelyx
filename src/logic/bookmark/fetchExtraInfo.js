import * as eventService from "../../models/eventSchemaService.js";
import * as catalogService from "../../models/catalogSchemaService.js";
import * as askService from "../../models/askSchemaService.js";
import * as postService from "../../models/postSchemaService.js";

export const fetchExtraInfo = async (postId, postType) => {
  switch (postType) {
    case "event":
      return eventService.findById(postId);

    case "ask":
      return askService.getAskById(postId);

    case "mart":
      return catalogService.getCatalogItemById(postId);

    case "post":
      return postService.getPostById(postId);

    default:
      return null;
  }
};
