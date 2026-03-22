import { withErrorHandling } from "./middleware/error.js";
import { routeRequest } from "./router.js";

export default {
  fetch(request, env, ctx) {
    return withErrorHandling(routeRequest, request, env, ctx);
  }
};
