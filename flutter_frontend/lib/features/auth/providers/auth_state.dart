/// Authentication state model for the app.
///
/// This file defines the current auth stage, the signed-in user (when
/// available), any loading state, and an optional error message.
import '../../../shared/enums/auth_status.dart';
import '../data/auth_models.dart';

class AuthState {
  final AuthStatus status;

  final UserModel? user;

  final String? errorMessage;

  final String? verificationId;

  final String? phoneNumber;

  final bool isLoading;

  const AuthState({
    required this.status,
    this.user,
    this.isLoading = false,
    this.errorMessage,
    this.verificationId,
    this.phoneNumber,
  });

  /// Returns a new [AuthState] with updated fields.
  ///
  /// This helper is used to mutate auth state immutably from the notifier.
  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    bool? isLoading,
    String? errorMessage,
    String? verificationId,
    String? phoneNumber,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      verificationId: verificationId ?? this.verificationId,
      phoneNumber: phoneNumber ?? this.phoneNumber,
    );
  }
}
