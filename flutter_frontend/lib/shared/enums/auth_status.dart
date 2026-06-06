/// Authentication lifecycle states used in the app.
///
/// The auth layer maps backend and Firebase responses into one of these
/// statuses for routing and UI decisions.
enum AuthStatus {
  /// Initial loading state while auth is being checked.
  loading,

  /// No user is signed in.
  unauthenticated,

  /// User has signed in to Firebase but has not completed the profile.
  profileIncomplete,

  /// User profile is complete, but admin approval is still pending.
  pendingApproval,

  /// User is fully authenticated and allowed to use the app.
  authenticated,

  /// User has been blocked by the backend and cannot proceed.
  blocked,

  /// An error occurred during authentication checks.
  error,
}
