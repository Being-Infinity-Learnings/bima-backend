/// Data model representing the authenticated user.
///
/// This model is built from the backend auth profile response.
class UserModel {
  final String id;
  final String firebaseUid;

  final String? email;
  final String? phone;

  final String fullName;
  final String gender;

  final String collegeName;
  final String rollNumber;

  final String role;

  final bool approved;
  final bool blocked;

  UserModel({
    required this.id,
    required this.firebaseUid,
    required this.email,
    required this.phone,
    required this.fullName,
    required this.gender,
    required this.collegeName,
    required this.rollNumber,
    required this.role,
    required this.approved,
    required this.blocked,
  });

  /// Creates a [UserModel] from the JSON payload returned by the backend.
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'],
      firebaseUid: json['firebaseUid'],
      email: json['email'],
      phone: json['phone'],
      fullName: json['fullName'],
      gender: json['gender'],
      collegeName: json['collegeName'],
      rollNumber: json['rollNumber'],
      role: json['role'],
      approved: json['approved'],
      blocked: json['blocked'],
    );
  }
}
