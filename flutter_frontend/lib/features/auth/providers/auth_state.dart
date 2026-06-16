/// Authentication state model for the app.
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

  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    bool? isLoading,
    String? errorMessage,
    String? verificationId,
    String? phoneNumber,
    bool clearError = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      // If clearError is true, set null. Otherwise use the new value if
      // provided, falling back to the existing one.
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      verificationId: verificationId ?? this.verificationId,
      phoneNumber: phoneNumber ?? this.phoneNumber,
    );
  }
}
