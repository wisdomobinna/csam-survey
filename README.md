# Image Evaluation Survey System

A comprehensive React-based research platform for conducting large-scale image evaluation studies with enhanced assignment algorithms and Prolific integration.

## 🎯 Overview

This system is designed for researchers conducting visual content assessment studies. It provides a complete solution for managing participants, assigning images, collecting responses, and analyzing data with built-in quality controls and balanced distribution algorithms.

## ✨ Key Features

### 🔧 Enhanced Assignment System
- **5-Assignment Limit**: Each image is shown to maximum 5 participants for optimal data quality
- **Balanced Distribution**: Automatically assigns 5 images from each set (Set1: 1-1200, Set2: 1201-2400)
- **Mixed Presentation Order**: Randomized sequence to prevent bias
- **Concurrency Protection**: Transaction-based assignment to prevent race conditions
- **Capacity Monitoring**: Real-time tracking of system capacity and assignment limits

### 👥 Multi-Modal Participant Management
- **Prolific Integration**: Seamless auto-login with URL parameter detection
- **Pre-assigned Participants**: Batch creation of participant IDs with image assignments
- **Test Mode**: Dedicated testing environment with separate data tracking
- **Admin Dashboard**: Comprehensive management interface

### 📊 Study Flow Management
- **Three-Step Process**: Consent → Main Survey (Image Evaluation) → Demographics → Completion
- **Progress Tracking**: Automatic saving and resumption capabilities
- **Completion Validation**: Multi-level verification of study completion
- **Data Integrity**: Comprehensive validation and error handling

### 🛡️ Data Quality & Security
- **Anonymous Authentication**: Firebase-based secure authentication
- **Data Persistence**: Real-time saving with offline capability
- **Export Functionality**: CSV export for analysis
- **System Validation**: Built-in integrity checks and monitoring

## 🏗️ System Architecture

### Frontend (React)
```
src/
├── components/           # Reusable UI components
│   ├── DatabaseStats.js
│   └── SurveyForm.js
├── pages/               # Main application pages
│   ├── Login.js         # Enhanced login with Prolific integration
│   ├── ConsentPage.js   # Informed consent collection
│   ├── Survey.js        # Main image evaluation interface
│   ├── Demographics.js  # Demographics survey (final step)
│   ├── Completion.js    # Study completion page
│   ├── AdminDashboard.js # Administrative interface
│   └── Setup.js         # System setup and batch operations
├── utils/               # Core business logic
│   ├── balancedImageAssignment.js     # Enhanced assignment algorithm
│   ├── simpleConcurrentAssignment.js  # Concurrency protection
│   ├── assessment-tracking.js         # Progress tracking
│   ├── firebaseSetup.js              # Database utilities
│   └── csvExport.js                   # Data export functionality
└── firebase/
    └── config.js        # Firebase configuration
```

### Backend (Firebase)
```
Collections:
├── loginIDs/            # Participant records and assignments
├── surveyResponses/     # Individual image evaluations
├── systemData/          # Assignment tracking and configuration
├── assignmentLogs/      # Assignment history and auditing
└── systemConfig/        # Global system configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- Firebase project with Firestore and Storage
- Qualtrics account (for surveys)
- Prolific account (optional, for participant recruitment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd image-evaluation-survey
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   Create `.env.local` with your Firebase configuration:
   ```env
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   ```

4. **Configure Qualtrics**
   Add your Qualtrics survey URLs:
   ```env
   REACT_APP_QUALTRICS_SURVEY_URL=https://georgetown.az1.qualtrics.com/jfe/form/SV_xxxxx
   REACT_APP_QUALTRICS_DEMOGRAPHICS_URL=https://georgetown.az1.qualtrics.com/jfe/form/SV_yyyyy
   ```

5. **Start the development server**
   ```bash
   npm start
   ```

### Firebase Setup

1. **Upload Images**
   Organize images in Firebase Storage:
   ```
   /set1/1.png, /set1/2.png, ..., /set1/1200.png
   /set2/1201.png, /set2/1202.png, ..., /set2/2400.png
   ```

2. **Initialize Database**
   - Navigate to `/setup` as admin
   - Run system initialization
   - Create participant batches if needed

## 📋 Usage Guide

### For Researchers

#### 1. **System Setup**
- Access admin dashboard with `ADMIN` login
- Navigate to Setup page for system initialization
- Upload images to Firebase Storage in correct structure
- Configure assignment parameters

#### 2. **Participant Management**
- **Prolific Integration**: Use generated URL for automatic participant flow
- **Pre-assigned Participants**: Create batches with specific IDs
- **Test Participants**: Use `TEST` login for system validation

#### 3. **Study Monitoring**
- Real-time capacity monitoring
- Assignment distribution tracking
- Progress analytics and completion rates
- Data export capabilities

### For Participants

#### 1. **Prolific Participants**
- Click study link from Prolific
- Automatic login and image assignment
- Guided through consent → images → demographics

#### 2. **Direct Participants**
- Enter assigned participant ID
- Manual consent and study flow
- Same evaluation process

#### 3. **Study Flow**
```
Login/Auto-Login → Consent → Image Evaluation → Demographics → Completion
```

### Assignment Algorithm Details

The enhanced assignment system ensures optimal data quality:

1. **Initialization**: System tracks assignment counts for all 2400 images
2. **Capacity Check**: Verifies available images before assignment
3. **Balanced Selection**: 
   - 5 images from Set1 (least-assigned priority)
   - 5 images from Set2 (least-assigned priority)
   - Mixed presentation order
4. **Limit Enforcement**: Maximum 5 assignments per image
5. **Transaction Safety**: Prevents race conditions during concurrent assignments

## 🔧 Administrative Features

### Admin Dashboard
- **Capacity Monitor**: Real-time assignment tracking with 5-limit enforcement
- **User Management**: View, filter, and manage all participants
- **Assignment Statistics**: Detailed breakdown by set and assignment count
- **System Maintenance**: Reset functions and data management
- **Bulk Operations**: Create multiple participants with enhanced assignments

### Enhanced Assignment System
- **5-Assignment Limit**: Each image shown to maximum 5 participants
- **Balanced Distribution**: Equal representation from both image sets
- **Priority Algorithm**: Least-assigned images selected first
- **Capacity Warnings**: Alerts when approaching system limits
- **Fallback Protection**: Graceful handling of capacity exceeded scenarios

### Data Export & Analysis
- **CSV Export**: Comprehensive data export functionality
- **Response Tracking**: Detailed logging of all participant interactions
- **Progress Analytics**: Real-time study progress monitoring
- **Quality Metrics**: Assignment distribution and completion analytics

## 🛠️ Configuration Options

### Assignment Configuration
```javascript
const ASSIGNMENT_CONFIG = {
  maxAssignmentsPerImage: 5,    // Maximum times each image is shown
  imagesPerUser: 10,            // Total images per participant
  targetImagesPerSet: 5,        // Images from each set
  set1Range: { start: 1, end: 1200 },
  set2Range: { start: 1201, end: 2400 }
};
```

### Study Flow Configuration
- Consent collection and validation
- Image evaluation with Qualtrics integration
- Demographics survey (final step)
- Completion tracking and redirect

## 📊 Data Structure

### Participant Record
```javascript
{
  internalUserId: "login_timestamp_random",
  displayId: "participant_display_id",
  prolificPid: "prolific_participant_id", // if applicable
  assignedImages: [
    {
      id: "set1_123",
      name: "123.png", 
      set: "set1",
      path: "set1/123.png"
    }
  ],
  hasConsented: boolean,
  mainSurveyCompleted: boolean,
  demographicsCompleted: boolean,
  surveyCompleted: boolean,
  imageAssignmentStatus: "assigned",
  enhancedAssignment: true,
  autoAssignmentDetails: {
    assignmentSystem: "enhanced_balanced_5_limit",
    set1Count: 5,
    set2Count: 5,
    mixedOrder: "set1 → set2 → set1 → ..."
  }
}
```

### Response Data
```javascript
{
  participantId: "user_id",
  imageId: "set1_123",
  imageNumber: "123",
  responseData: {
    imageDescription: "photo-person",
    eyewearPresent: "yes",
    eyewearConfidence: 2,
    ageConfidence: -1,
    // ... additional evaluation data
  },
  submittedAt: timestamp
}
```

## 🚨 Troubleshooting

### Common Issues

#### Assignment Capacity Exceeded
- **Symptom**: "Study at capacity" message
- **Solution**: Check assignment statistics in admin dashboard, reset counts if needed

#### Image Loading Failures
- **Symptom**: Images not displaying
- **Solution**: Verify Firebase Storage structure and permissions

#### Prolific Integration Issues
- **Symptom**: Auto-login not working
- **Solution**: Check URL parameters and Prolific configuration

#### Concurrent Assignment Conflicts
- **Symptom**: Assignment failures during high traffic
- **Solution**: System includes automatic retry logic and fallback mechanisms

### System Monitoring

- **Capacity Alerts**: System warns at 90% capacity
- **Error Logging**: Comprehensive error tracking and reporting
- **Performance Metrics**: Response times and completion rates
- **Data Validation**: Automatic integrity checks

## 🔒 Security & Privacy

- **Anonymous Authentication**: No personal data collection beyond study needs
- **Data Encryption**: All data encrypted in transit and at rest
- **Access Controls**: Role-based access with admin-only functions
- **Audit Logging**: Complete audit trail of all system operations

## 📈 Scalability

The system is designed to handle large-scale studies:
- **Concurrent Users**: Supports multiple simultaneous participants
- **Data Volume**: Efficiently handles thousands of participants and responses
- **Assignment Algorithm**: Optimized for performance with large image sets
- **Real-time Updates**: Efficient real-time capacity and progress tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For technical support or questions:
- Review the troubleshooting section
- Check Firebase console for errors
- Verify Qualtrics integration settings
- Contact the development team

## 🔮 Future Enhancements

- **Advanced Analytics**: Enhanced reporting and visualization
- **Multi-Study Support**: Support for multiple concurrent studies
- **Mobile Optimization**: Enhanced mobile experience
- **API Integration**: RESTful API for external integrations
- **Machine Learning**: Automated quality assessment and participant screening