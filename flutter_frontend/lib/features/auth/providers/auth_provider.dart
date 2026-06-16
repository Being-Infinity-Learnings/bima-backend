/// Riverpod provider and auth notifier for user authentication flows.
///
/// This file contains the state notifier responsible for sign-in, sign-up,
/// profile completion, and auth status transitions.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/enums/auth_status.dart';

import '../data/auth_repository.dart';

import 'auth_state.dart';

import '../data/register_profile_request.dart';
import '../data/update_profile_request.dart';

import 'package:dio/dio.dart';

import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/services/fcm_service.dart';
import '../../../core/services/connectivity_service.dart';

/// A provider that exposes authentication state to the rest of the app.
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(),
);

/// Manages auth-related actions and state transitions.
class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState(status: AuthStatus.loading));

  final AuthRepository _repo = AuthRepository();

  /// Checks whether the user is currently authenticated.
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

      // Initialize FCM now that we have a fully authenticated, approved user
      await FcmService.initialize();
    } catch (e) {
      if (e is DioException) {
        // Check for network/connectivity errors first
        if (e.type == DioExceptionType.connectionError ||
            e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout) {
          final hasInternet = await ConnectivityService.hasInternet();
          if (!hasInternet) {
            state = AuthState(
              status: AuthStatus.error,
              errorMessage:
                  'No internet connection. Please check your network.',
            );
            return;
          }
        }

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
          errorMessage: 'Server error occurred. Please try again.',
        );

        return;
      }

      state = AuthState(
        status: AuthStatus.error,
        errorMessage: 'Something went wrong. Please try again.',
      );
    } finally {
      state = state.copyWith(isLoading: false);
    }
  }

  /// Attempts to sign in the user with email and password.
  Future<void> login({required String email, required String password}) async {
    state = state.copyWith(isLoading: true, clearError: true);

    // Check connectivity first
    final hasInternet = await ConnectivityService.hasInternet();
    if (!hasInternet) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'No internet connection. Please check your network.',
      );
      return;
    }

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

        case 'network-request-failed':
          message = 'No internet connection. Please check your network.';
          break;

        default:
          message = 'Unable to sign in. Please try again.';
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
    // Unregister FCM token from backend before signing out
    await FcmService.unregister();

    await _repo.signOut();

    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Creates a new Firebase account using email and password.
  Future<void> createFirebaseAccount({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);

    final hasInternet = await ConnectivityService.hasInternet();
    if (!hasInternet) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'No internet connection. Please check your network.',
      );
      return;
    }

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
          message = 'No internet connection. Please check your network.';
          break;

        default:
          message = 'Unable to create account. Please try again.';
      }

      state = state.copyWith(isLoading: false, errorMessage: message);
    }
  }

  /// Submits profile completion data to the backend.
  Future<void> completeProfile({
    required String fullName,
    required String gender,
    required String collegeName,
    required String rollNumber,
    required String email,
  }) async {
    state = state.copyWith(isLoading: true);

    final hasInternet = await ConnectivityService.hasInternet();
    if (!hasInternet) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'No internet connection. Please check your network.',
      );
      return;
    }

    try {
      final user = await _repo.registerProfile(
        RegisterProfileRequest(
          fullName: fullName,
          gender: gender,
          collegeName: collegeName,
          rollNumber: rollNumber,
          email: email,
        ),
      );

      if (!user.approved) {
        state = AuthState(status: AuthStatus.pendingApproval, user: user);
        return;
      }

      state = AuthState(status: AuthStatus.authenticated, user: user);
    } on DioException catch (e) {
      String message;

      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout) {
        message = 'No internet connection. Please check your network.';
      } else {
        final statusCode = e.response?.statusCode;

        switch (statusCode) {
          case 400:
            final body = e.response?.data;
            message = (body is Map && body['error'] != null)
                ? body['error'].toString()
                : 'Please check the information you entered.';
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
            message = 'Unable to complete registration. Please try again.';
        }
      }

      state = state.copyWith(isLoading: false, errorMessage: message);
    } finally {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> updateProfile({
    required String fullName,
    required String gender,
    required String collegeName,
    required String rollNumber,
    required String email,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);

    final hasInternet = await ConnectivityService.hasInternet();
    if (!hasInternet) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'No internet connection. Please check your network.',
      );
      throw Exception('No internet connection.');
    }

    try {
      final user = await _repo.updateProfile(
        UpdateProfileRequest(
          fullName: fullName,
          gender: gender,
          collegeName: collegeName,
          rollNumber: rollNumber,
          email: email,
        ),
      );

      state = AuthState(status: AuthStatus.authenticated, user: user);
    } on DioException catch (e) {
      String message;

      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout) {
        message = 'No internet connection. Please check your network.';
      } else {
        final statusCode = e.response?.statusCode;
        switch (statusCode) {
          case 400:
            message = 'Please check the information you entered.';
            break;
          case 409:
            message = 'This roll number is already in use.';
            break;
          case 500:
            message = 'Server error. Please try again later.';
            break;
          default:
            message = 'Failed to update profile. Please try again.';
        }
      }

      state = state.copyWith(
        isLoading: false,
        status: AuthStatus.authenticated,
        errorMessage: message,
      );

      rethrow;
    }
  }

  /// Clears any active authentication error message.
  void clearError() {
    if (state.errorMessage == null) {
      return;
    }

    state = state.copyWith(clearError: true);
  }

  Future<void> sendOtp(String phoneNumber) async {
    state = state.copyWith(isLoading: true, clearError: true);

    // Check connectivity before attempting OTP send
    final hasInternet = await ConnectivityService.hasInternet();
    if (!hasInternet) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'No internet connection. Please check your network.',
      );
      return;
    }

    await _repo.verifyPhoneNumber(
      phoneNumber: phoneNumber,

      verificationCompleted: (_) {
        // Auto-verification handled
      },

      verificationFailed: (e) {
        String message;

        switch (e.code) {
          case 'invalid-phone-number':
            message = 'The phone number entered is invalid.';
            break;

          case 'too-many-requests':
            message =
                'Too many OTP requests. Please wait a moment and try again.';
            break;

          case 'network-request-failed':
            message = 'No internet connection. Please check your network.';
            break;

          case 'quota-exceeded':
            message = 'SMS quota exceeded. Please try again later.';
            break;

          case 'app-not-authorized':
            message = 'App is not authorized to send SMS. Contact support.';
            break;

          default:
            // message = e.message ?? 'Failed to send OTP. Please try again.';
            message = 'Failed to send OTP. Please try again.';
        }

        state = state.copyWith(isLoading: false, errorMessage: message);
      },

      codeSent: (verificationId, _) {
        state = state.copyWith(
          isLoading: false,
          verificationId: verificationId,
          phoneNumber: phoneNumber,
        );
      },

      codeAutoRetrievalTimeout: (_) {
        // Timeout is handled; user can still enter manually
      },
    );
  }

  Future<void> resendOtp() async {
    final phoneNumber = state.phoneNumber;

    if (phoneNumber == null) {
      return;
    }

    await sendOtp(phoneNumber);
  }

  Future<void> verifyOtp(String otp) async {
    final verificationId = state.verificationId;

    if (verificationId == null) {
      return;
    }

    state = state.copyWith(isLoading: true, clearError: true);

    // Check connectivity before verifying
    final hasInternet = await ConnectivityService.hasInternet();
    if (!hasInternet) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'No internet connection. Please check your network.',
      );
      return;
    }

    try {
      await _repo.signInWithOtp(verificationId: verificationId, otp: otp);

      await checkAuth();
    } on FirebaseAuthException catch (e) {
      String message;

      switch (e.code) {
        case 'invalid-verification-code':
          message = 'Incorrect OTP. Please check and try again.';
          break;

        case 'session-expired':
          message = 'OTP has expired. Please go back and request a new code.';
          break;

        case 'network-request-failed':
          message = 'No internet connection. Please check your network.';
          break;

        default:
          message = 'Verification failed. Please try again.';
      }

      state = state.copyWith(isLoading: false, errorMessage: message);
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Something went wrong. Please try again.',
      );
    }
  }

  void setError(String message) {
    state = state.copyWith(errorMessage: message);
  }
}
