import '../../../shared/enums/auth_status.dart';
import '../data/auth_models.dart';

class AuthState {
  final AuthStatus status;

  final UserModel? user;

  final String? errorMessage;

  final bool isLoading;

  const AuthState({
    required this.status,
    this.user,
    this.isLoading = false,
    this.errorMessage,
  });

  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    bool? isLoading,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}
