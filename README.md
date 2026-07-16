# Ticket Booking App

**Live site:** http://ticket-booking-app-frontend-527133285656.s3-website-us-east-1.amazonaws.com
**Repository:** https://github.com/likhithagonugunta-ctrl/ticket-booking-app

---
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

## New: multi-tab UI + Stripe payments

The frontend now has 5 tabs (Home, Events, Nearby, Tickets, Profile) with a search
bar, vibrant category-colored event posters, and real payment collection via
Stripe Checkout — a booking is only created in DynamoDB after payment succeeds
(via a webhook), so seats can't be reserved without paying.

### One-time Stripe setup

1. Create a free account at https://dashboard.stripe.com/register
2. Go to **Developers → API keys**, copy the **Secret key** (starts `sk_test_...`
   while testing, `sk_live_...` for real payments)
3. Store it in AWS Secrets Manager, **in the same region as your stack (us-east-1)**:
   ```
   aws secretsmanager create-secret --name stripe-secret-key \
     --secret-string "sk_test_..." --region us-east-1
   ```
4. Deploy once so the `WebhookUrl` output exists:
   ```
   cd infrastructure
   sam deploy --parameter-overrides StripeSecretKey=sk_test_... StripeWebhookSecret=placeholder FrontendUrlParam=""
   ```
   Copy the `WebhookUrl` and `FrontendUrl` values from the output.
5. In the Stripe dashboard, go to **Developers → Webhooks → Add endpoint**,
   paste the `WebhookUrl`, and select the `checkout.session.completed` event.
   Copy the **Signing secret** it gives you (starts `whsec_...`).
6. Store that too:
   ```
   aws secretsmanager create-secret --name stripe-webhook-secret \
     --secret-string "whsec_..." --region us-east-1
   ```
7. Redeploy with the real webhook secret and frontend URL:
   ```
   sam deploy --parameter-overrides StripeSecretKey=sk_test_... StripeWebhookSecret=whsec_... FrontendUrlParam=<FrontendUrl from step 4>
   ```

If you're using the CI/CD pipeline, `buildspec.yml` already pulls both secrets
from Secrets Manager automatically on every push — you only need steps 1-3, 5-6
done once; the pipeline handles the `sam deploy` with the right parameters.

### Testing payments

Use Stripe's test card `4242 4242 4242 4242`, any future expiry date, any CVC,
any ZIP — no real money moves in test mode.

### New API routes

| Method | Path                    | Description                          |
|--------|--------------------------|----------------------------------------|
| POST   | `/checkout`               | Starts a Stripe Checkout session       |
| POST   | `/webhook`                 | Stripe calls this on payment success   |
| GET    | `/bookings/lookup?session_id=` | Look up a booking after checkout  |
| GET    | `/bookings?email=`         | List a user's bookings (My Tickets)    |


- `pipeline.yaml` uses `AdministratorAccess` for the CodeBuild/CodePipeline roles
  for simplicity — scope this down to the specific services used.
- The S3 frontend bucket is public-read for static hosting; consider fronting it
  with CloudFront + OAC instead of direct public S3 website hosting.
- Add input validation, auth (e.g., Cognito), and per-event overbooking limits
  as needed for a real production booking system.
