# Ticket Booking Application (AWS Serverless)

A serverless ticket booking app: static frontend on S3, REST API via API Gateway +
Lambda, data in DynamoDB, deployed automatically via CodePipeline/CodeBuild.

## Architecture

| Layer          | AWS Service                          |
|----------------|---------------------------------------|
| Frontend       | S3 (static website hosting)           |
| API            | API Gateway (REST)                    |
| Backend logic  | Lambda (Node.js 20)                   |
| Database       | DynamoDB (Events, Bookings tables)    |
| CI/CD          | CodePipeline + CodeBuild              |
| IaC            | AWS SAM (CloudFormation)              |

## Folder structure

```
ticket-booking-app/
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── config.js          # overwritten at deploy time with real API URL
├── backend/
│   ├── src/
│   │   ├── db.js
│   │   ├── listEvents.js
│   │   ├── getEvent.js
│   │   ├── createBooking.js
│   │   └── listBookings.js
│   ├── seed.js             # optional: seed sample events
│   └── package.json
├── infrastructure/
│   ├── template.yaml       # SAM template: S3, DynamoDB, Lambda, API Gateway
│   └── pipeline.yaml       # CodePipeline + CodeBuild
├── buildspec.yml           # CodeBuild build/deploy steps
└── README.md
```

## API

| Method | Path                | Description               |
|--------|----------------------|----------------------------|
| GET    | `/events`             | List all events            |
| GET    | `/events/{eventId}`   | Get one event               |
| POST   | `/bookings`            | Create a booking            |
| GET    | `/bookings`            | List all bookings           |

`POST /bookings` body:
```json
{ "eventId": "...", "userName": "Jane Doe", "email": "jane@example.com", "seats": 2 }
```

## Deploy manually (first time / local)

Prerequisites: AWS CLI configured, [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html), Node.js 20.

```bash
# 1. Install backend deps
cd backend && npm install && cd ..

# 2. Build and deploy the app stack (S3, Lambda, API Gateway, DynamoDB)
cd infrastructure
sam build --template template.yaml
sam deploy --guided \
  --stack-name ticket-booking-app \
  --capabilities CAPABILITY_IAM
cd ..

# 3. Note the ApiEndpoint and FrontendBucketName from the stack outputs, then:
echo "window.API_BASE_URL = \"<ApiEndpoint from output>\";" > frontend/config.js
aws s3 sync frontend/ s3://<FrontendBucketName>/ --delete

# 4. (Optional) seed sample events
EVENTS_TABLE=ticket-booking-app-Events node backend/seed.js
```

Open the `FrontendUrl` output value in your browser.

## Set up the CI/CD pipeline

1. Push this project to a GitHub repo.
2. Store a GitHub personal access token (repo scope) in AWS Secrets Manager, note its ARN.
3. Deploy the pipeline stack:

```bash
aws cloudformation deploy \
  --template-file infrastructure/pipeline.yaml \
  --stack-name ticket-booking-pipeline \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    GitHubOwner=<your-username> \
    GitHubRepo=<your-repo> \
    GitHubBranch=main \
    GitHubTokenSecretArn=<secret-arn>
```

From then on, every push to `main` triggers CodeBuild, which runs `buildspec.yml`:
builds the SAM app, deploys the backend stack, injects the live API URL into
`frontend/config.js`, and syncs the frontend to S3.

## Notes / things to harden before production

- `pipeline.yaml` uses `AdministratorAccess` for the CodeBuild/CodePipeline roles
  for simplicity — scope this down to the specific services used.
- The S3 frontend bucket is public-read for static hosting; consider fronting it
  with CloudFront + OAC instead of direct public S3 website hosting.
- Add input validation, auth (e.g., Cognito), and per-event overbooking limits
  as needed for a real production booking system.
