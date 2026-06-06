/// Riverpod provider and auth notifier for user authentication flows.
///
/// This file contains the state notifier responsible for sign-in, sign-up,
/// profile completion, and auth status transitions.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/enums/auth_status.dart';

import '../data/auth_repository.dart';

import 'auth_state.dart';

import '../data/register_profile_request.dart';

import 'package:dio/dio.dart';

import 'package:firebase_auth/firebase_auth.dart';

/// A provider that exposes authentication state to the rest of the app.
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(),
);

/// Manages auth-related actions and state transitions.
class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState(status: AuthStatus.loading));

  final AuthRepository _repo = AuthRepository();

  /// Checks whether the user is currently authenticated.
  ///
  /// This method reads the Firebase user, retrieves the profile, and updates
  /// auth state to the appropriate status for routing.
  Future<void> checkAuth() async {
    state = state.copyWith(isLoading: true);

    try {
      final firebaseUser = _repo.currentFirebaseUser;

      if (firebaseUser == null) {
        state = const AuthState(status: AuthStatus.unauthenticated);
        return;
      }

      final user = await _repo.getMyProfile();

      if (user.blocked) {
        state = AuthState(status: AuthStatus.blocked, user: user);
        return;
      }

      if (!user.approved) {
        state = AuthState(status: AuthStatus.pendingApproval, user: user);
        return;
      }

      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (e) {
      if (e is DioException) {
        final statusCode = e.response?.statusCode;

        if (statusCode == 404) {
          state = const AuthState(status: AuthStatus.profileIncomplete);
          return;
        }

        if (statusCode == 401) {
          state = const AuthState(status: AuthStatus.unauthenticated);
          return;
        }

        if (statusCode == 403) {
          state = const AuthState(status: AuthStatus.blocked);
          return;
        }

        state = AuthState(
          status: AuthStatus.error,
          errorMessage: 'Server error occurred',
        );

        return;
      }

      state = AuthState(
        status: AuthStatus.error,
        errorMessage: 'Something went wrong',
      );
    } finally {
      state = state.copyWith(isLoading: false);
    }
  }

  /// Attempts to sign in the user with email and password.
  ///
  /// On success it refreshes auth state via [checkAuth]. On failure it sets a
  /// user-friendly error message.
  Future<void> login({required String email, required String password}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      await _repo.signIn(email: email, password: password);

      await checkAuth();
    } on FirebaseAuthException catch (e) {
      String message;

      switch (e.code) {
        case 'invalid-credential':
          message = 'Incorrect email or password.';
          break;

        case 'user-not-found':
          message = 'No account found with this email.';
          break;

        case 'wrong-password':
          message = 'Incorrect email or password.';
          break;

        case 'invalid-email':
          message = 'Please enter a valid email address.';
          break;

        case 'too-many-requests':
          message = 'Too many login attempts. Please try again later.';
          break;

        default:
          message = 'Unable to sign in.';
      }

      state = state.copyWith(isLoading: false, errorMessage: message);
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Something went wrong. Please try again.',
      );
    }
  }

  /// Signs the current user out and resets auth state.
  Future<void> logout() async {
    await _repo.signOut();

    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Creates a new Firebase account using email and password.
  ///
  /// After account creation, this method updates state to indicate the
  /// profile still needs to be completed.
  Future<void> createFirebaseAccount({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      await _repo.createFirebaseUser(email: email, password: password);

      state = const AuthState(status: AuthStatus.profileIncomplete);
    } on FirebaseAuthException catch (e) {
      String message;

      switch (e.code) {
        case 'email-already-in-use':
          message = 'An account already exists with this email.';
          break;

        case 'weak-password':
          message = 'Password must be at least 6 characters.';
          break;

        case 'invalid-email':
          message = 'Please enter a valid email address.';
          break;

        case 'network-request-failed':
          message = 'No internet connection.';
          break;

        default:
          message = 'Unable to create account.';
      }

      state = state.copyWith(isLoading: false, errorMessage: message);
    }
  }

  /// Submits profile completion data to the backend.
  ///
  /// This is the second registration step after creating a Firebase account.
  Future<void> completeProfile({
    required String fullName,
    required String gender,
    required String collegeName,
    required String rollNumber,
  }) async {
    state = state.copyWith(isLoading: true);

    try {
      final user = await _repo.registerProfile(
        RegisterProfileRequest(
          fullName: fullName,
          gender: gender,
          collegeName: collegeName,
          rollNumber: rollNumber,
        ),
      );

      if (!user.approved) {
        state = AuthState(status: AuthStatus.pendingApproval, user: user);
        return;
      }

      state = AuthState(status: AuthStatus.authenticated, user: user);
    } on DioException catch (e) {
      String message;

      final statusCode = e.response?.statusCode;

      switch (statusCode) {
        case 400:
          message = 'Please check the information you entered.';
          break;

        case 401:
          message = 'Session expired. Please sign in again.';
          break;

        case 409:
          message = 'This roll number is already registered.';
          break;

        case 500:
          message = 'Server error. Please try again later.';
          break;

        default:
          message = 'Unable to complete registration.';
      }

      state = state.copyWith(isLoading: false, errorMessage: message);
    } finally {
      state = state.copyWith(isLoading: false);
    }
  }

  /// Clears any active authentication error message.
  void clearError() {
    if (state.errorMessage == null) {
      return;
    }

    state = state.copyWith(errorMessage: null);
  }
}
