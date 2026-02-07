# SyncroGate System Features

## Admin Panel

### Authentication & Access
- **Admin Login**: School administrators can log into SyncroGate using authorized credentials for secure access to monitoring data and administrative functions

### Student Management
- **Student Information Management**: View, create, update, and delete student accounts
- **QR Code Management**: Generate and assign QR codes for students, ensuring each student has a unique digital identifier for secure campus access
- **Bulk QR Code Generation**: Generate QR codes for multiple students at once

### Parent Management
- **Parent Information Management**: View and delete parent accounts when necessary, with all actions securely recorded in the system database

### Monitoring & Logs
- **Entry and Exit Monitoring**: Access to live dashboard containing real-time logs of student entries and exits, showing student name, grade level, time, and gate location
- **Activity Logs**: View system activity logs and Arduino events for monitoring and troubleshooting

### Notifications & Communication
- **System Announcements**: Create and post announcements within SyncroGate, which are delivered to students and parents, ensuring timely communication of important updates, events, or system information
- **Push Notifications**: Send push notifications to users
- **SMS Notifications**: Send SMS notifications to users
- **Notification History**: View notification history for users

### System Management
- **User Management**: View all users in the system
- **System Logs**: Access system logs for monitoring and debugging

---

## Parent Panel

### Authentication & Account Management
- **Parent Login**: Parents can log in to SyncroGate using registered credentials
- **Account Linking**: Send link requests to associate account with child's profile, enabling personalized alerts and dashboard access once approved
- **Linked Students View**: View all linked students

### Real-Time Monitoring
- **Real-Time Entry and Exit Notifications**: Receive instant push notifications whenever linked child enters or exits school, including child's name, time of entry/exit, and confirmation of successful QR scan

### Attendance & History
- **Student Attendance View**: View linked child's previous entry and exit logs, organized by date, providing clear history of attendance and movement patterns

### Notifications
- **Push Notification Alerts**: Receive instant alerts in real time for child's entry/exit events and schedule changes
- **Notification History**: View notification history

### Announcements
- **View System Announcements**: View system announcements posted by administrators

### Schedules
- **Schedule Viewing**: View linked child's schedules shared by the student

---

## Student Panel

### Authentication & Account Management
- **Student Login**: Students can log in to SyncroGate using registered credentials
- **Account Linking**: Link account to parent or guardian's profile through manual request, enabling shared access to attendance records, schedules, and notifications once approved

### QR Code Management
- **View Personal QR Code**: View assigned QR code within the app for attendance tracking, ensuring smooth and accurate entry and exit scanning

### Attendance Management
- **Attendance Log Viewing**: View all historic entries and exits with timestamps, allowing students to follow up on attendance patterns and verify recorded movements
- **Entry/Exit Correction**: Undo recent entry or exit within the app, provided no more than 5 minutes have passed since the scan, allowing correction of accidental scan-ins or scan-outs

### Schedule Management
- **Schedule Creation**: Create and manage personal schedules within the app
- **Schedule Sharing**: Share schedules with parents or guardians for viewing, helping keep parents informed of daily activities and routines
- **Schedule Viewing**: View personal schedules

### Notifications
- **Notification Alerts**: Receive alerts and notifications
- **Notification History**: View notification history

### Announcements
- **View System Announcements**: View system announcements posted by administrators

---

## QR Scanner System

### Scanning & Validation
- **QR Code Validation and Scanning**: QR scanner installed at school entry and exit points validates each student's personalized QR code, confirming student identity and logging entry or exit events instantly

### Automated Logging
- **Automated Time Logging**: Every successful scan automatically records the exact time and gate location in the centralized database, eliminating manual attendance encoding and ensuring precise, tamper-proof records

### Real-Time Synchronization
- **Real-Time Log Synchronization**: All scan data is updated instantly across the system, ensuring administrators, parents, and students have access to the most current attendance information without delays

---

## System-Wide Features

### Offline Support
- **Offline Mode**: System works offline with data synchronization when connection is restored

### Security
- **Secure Authentication**: Role-based access control ensuring users only access features appropriate to their role
- **QR Code Security**: QR codes are protected against screenshots and unauthorized duplication

