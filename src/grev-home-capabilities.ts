import { CLOUD_SAVE_MAX_BYTES, cloudSavesAvailable, type GrevHomeSavesEnv } from './grev-home-saves';
import { json } from './shared/http-security';

const API_VERSION = 1;

export async function handleGrevHomeCapabilitiesRequest(
  request: Request,
  env: GrevHomeSavesEnv
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== '/api/grev-home/capabilities') return null;
  if (request.method !== 'GET') return json({ ok:false, message:'Method not allowed.' }, 405);

  return json({
    ok:true,
    apiVersion:API_VERSION,
    optional:true,
    environment:env.APP_ENV,
    capabilities:{
      linking:true,
      accountRestore:true,
      multiDeviceAccounts:true,
      sharedProgression:true,
      sharedAchievements:true,
      deviceTokens:true,
      tokenRotation:true,
      perDeviceRevocation:true,
      linkMetadataSync:true,
      friends:true,
      friendRequests:true,
      presence:true,
      activity:true,
      sessionHistory:true,
      progressionSync:true,
      contentIdentity:true,
      profileTileSync:true,
      unifiedProfile:true,
      profileWidgets:true,
      favouriteGames:true,
      bestFriends:true,
      retroAchievements:true,
      messaging:true,
      cloudSaves:cloudSavesAvailable(env),
      offlineHistoryReplay:true,
      stalePresenceReplay:false
    },
    limits:{
      linkRequestSeconds:600,
      tokenLifetimeSeconds:7776000,
      tokenRotationOverlapSeconds:86400,
      presenceMinSeconds:60,
      presenceMaxSeconds:600,
      syncBatchSessions:100,
      cloudSaveMaxBytes:CLOUD_SAVE_MAX_BYTES
    }
  });
}
