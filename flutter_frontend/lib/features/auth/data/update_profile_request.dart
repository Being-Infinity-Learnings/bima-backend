class UpdateProfileRequest {
  final String fullName;
  final String gender;
  final String collegeName;
  final String rollNumber;
  final String email;

  const UpdateProfileRequest({
    required this.fullName,
    required this.gender,
    required this.collegeName,
    required this.rollNumber,
    required this.email,
  });

  Map<String, dynamic> toJson() {
    return {
      'fullName': fullName,
      'gender': gender,
      'collegeName': collegeName,
      'rollNumber': rollNumber,
      'email': email,
    };
  }
}