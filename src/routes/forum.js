export function getForumRoutes(handlers) {
  return [
    { path: "/api/forum/posts", method: "GET", handler: handlers.handleForumPosts },
    { path: "/api/forum/post", method: "GET", handler: handlers.handleForumPost },
    { path: "/api/forum/comments", method: "GET", handler: handlers.handleForumComments },
    { path: "/api/forum/create-post", method: "POST", handler: handlers.handleForumCreatePost },
    { path: "/api/forum/create-comment", method: "POST", handler: handlers.handleForumCreateComment },
    { path: "/api/forum/react", method: "POST", handler: handlers.handleForumReact },
    { path: "/api/forum/remove-post", method: "POST", handler: handlers.handleForumRemovePost }
  ];
}
