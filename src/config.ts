/**
 * Public configuration. The Trakt Client ID is a public identifier and is safe to commit
 * (login uses PKCE, so there is no secret and no server component).
 */
export const config = {
  /** Your Trakt application's Client ID (PKCE, no secret). */
  traktClientId: 'DxVnTswQIdegbiQF8VtVO5PAdGHa8xhZT3_a_m4-518',
  /** The Trakt One Pace show slug, taken from its trakt.tv/shows/<slug> URL. */
  traktShowSlug: 'one-pace',
};

export const traktConfigured = (): boolean => config.traktClientId.length > 0;
