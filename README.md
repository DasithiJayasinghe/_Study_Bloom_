# _Study_Bloom-Help Response_

# **Component Overview** 


 ## Backend Intergration

###Problem Overview 
--
The Study Bloom Help Response System addresses this issue by introducing a centralized platform where users can post concerns through a shared help feed. Unlike traditional systems, any available responder (without requiring a direct request) can proactively accept a concern and provide assistance.

Once a concern is accepted, a private chat channel is established between the requester and the responder. This chat enables real-time communication and supports multiple interaction formats, including text, image uploads, PDF sharing, and voice messages. To manage the lifecycle of each interaction, responders can update the chat status (e.g., active or resolved). When marked appropriately, the chat becomes read-only, preventing further modifications and preserving the conversation for reference.

Additionally, the system ensures accountability and quality of responses through a feedback mechanism. After a chat is closed, the requester is prompted to submit feedback, which is then stored in the responder’s profile. This helps evaluate responder performance and improve the overall reliability of the platform.Eachuser maintains separate request and response chat lists, ensuring clear organization and easy access to ongoing and completed interactions within the mobile application.


----

###  Folder Structure
![img_1.png](img_1.png)

- **config/**  
  Contains configuration files required for the application.
    - `db.js` – Establishes connection with the MongoDB database
    - `multer.js` – Handles file uploads (images, audio, PDFs, CSV files)
    - `socket.js` – Sets up real-time communication using Socket.IO

- **controllers/**  
  Contains the core business logic of the application.
    - `authController.js` – Handles user authentication (login/register)
    - `chatController.js` – Manages chat functionality (messages, media sharing)
    - `concernController.js` – Handles student concerns (create, accept, manage)
    - `feedbackController.js` – Processes feedback after chat completion

- **middleware/**  
  Includes custom middleware functions used in request processing.
    - `authMiddleware.js` – Secures routes using JWT authentication
    - `uploadMiddleware.js` – Handles file upload requests

- **models/**  
  Defines MongoDB schemas using Mongoose.
    - `User.js` – Stores user details
    - `Concern.js` – Stores help requests
    - `ChatRoom.js` – Manages chat sessions
    - `Message.js` – Stores chat messages (text, files, audio)
    - `Feedback.js` – Stores feedback given to responders

- **routes/**  
  Defines API endpoints and links them to controllers.
    - `authRoutes.js` – Authentication routes
    - `chatRoutes.js` – Chat-related APIs
    - `concernRoutes.js` – Concern management APIs
    - `feedbackRoutes.js` – Feedback APIs

- **server.js**  
  The main entry point of the backend. It initializes the Express server, connects to the database, configures middleware, and registers all routes.

---



## Frontend Intergration
# _Study_Bloom_
# The Exam Planner Module

The Exam Planner Module is a core feature of the StudyBloom mobile application, designed to help students efficiently organize and manage their exam schedules in one place. This module allows users to create, view, update, and delete exam entries with details such as subject, date, time, location, priority level, study progress, and personal notes. It provides both a list view and a calendar-style interface, enabling students to easily visualize upcoming exams and stay organized.

To enhance productivity, the module includes features such as exam reminders and notifications, a countdown timer showing time remaining for each exam, and a study progress tracker that helps users monitor their preparation level. Users can also search and filter exams based on subject or status (upcoming/past), making it easier to manage multiple exams.

Additionally, the module supports file uploads, allowing students to attach and preview important study materials such as lecture notes, syllabus PDFs, past papers, and exam guidelines directly within the app. A dedicated notes section is also available for each exam, enabling users to add quick reminders or study tips.

The backend is built using Node.js, Express, and MongoDB, following a structured MVC architecture with secure JWT-based authentication to ensure that users can only access their own data. Overall, the Exam Planner Module aims to provide a smart, organized, and user-friendly solution for managing academic schedules and improving exam preparation.
StudyBloom is a full-stack mobile application designed to support students in both academics and personal productivity through a cute, user-friendly, and pastel-themed interface. It allows students to manage their exam schedules, request and respond to academic help, participate in a public study community, and build a personal library of saved notes and resources. The app also includes a lifestyle and productivity module where users can track daily tasks, moods, study goals, and self-care habits, making it more than just a study tool. Built using React Native for the frontend and Node.js, Express, and MongoDB for the backend, StudyBloom follows a modular architecture with secure JWT authentication to protect user data and sessions. Each feature is organized into separate modules with full CRUD functionality and file upload support for study materials like PDFs, images, and documents. Overall, StudyBloom aims to create an engaging, organized, and supportive digital space where students can learn, collaborate, and manage their academic and personal life in one place

# _📖 Help Request Module_

The Help Request Module allows students to create and manage academic support requests within the Study Bloom mobile application.

Users can:

- Create new help requests with subject, title, and detailed description
- Upload attachments such as images or screenshots
- Mark requests as urgent
- Organize requests into folders
- View their own requests and manage them (delete, update)
- Browse the public Help Feed to see requests from other users
- View full request details and accept requests to provide help
- Initiate communication (chat) after accepting a request

This module is implemented using:

- React Native (Expo) for the mobile frontend
- Node.js & Express.js for backend APIs
- MongoDB for data storage
  
It includes full CRUD operations, file upload handling, validation, and secure access using authentication middleware.

