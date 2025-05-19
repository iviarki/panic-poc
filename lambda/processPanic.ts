import { SQSEvent, SQSRecord } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamoDbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dynamoDbClient);

const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('ProcessPanicLambda invoked with SQS event:', JSON.stringify(event, null, 2));

  if (!DYNAMODB_TABLE_NAME) {
    // This is a fatal configuration error. Throw to ensure message goes to DLQ.
    console.error('Critical Error: DYNAMODB_TABLE_NAME environment variable is not set.');
    throw new Error('DYNAMODB_TABLE_NAME environment variable is not set.');
  }

  for (const record of event.Records) {
    let panicId: string | undefined; // Define panicId here for broader scope in catch block

    try {
      let messageBody;
      try {
        messageBody = JSON.parse(record.body);
      } catch (parseError) {
        console.error(`[SQS Message ID: ${record.messageId}] Failed to parse SQS message body:`, record.body, parseError);
        // Skip this malformed message, it won't be processable
        continue;
      }
      
      panicId = messageBody.panicId;

      if (!panicId || typeof panicId !== 'string' || panicId.trim() === '') {
        console.error(`[SQS Message ID: ${record.messageId}] Missing or invalid panicId in SQS message body:`, messageBody);
        // Skip this message as panicId is crucial
        continue;
      }

      console.log(`[panicId: ${panicId}, SQS Message ID: ${record.messageId}] Processing panic event.`);

      // Simulate processing and update status in DynamoDB
      const processedAt = new Date().toISOString();
      const updateParams = {
        TableName: DYNAMODB_TABLE_NAME,
        Key: { panicId: panicId.trim() },
        UpdateExpression: 'set #status = :status, #processedAt = :processedAt, #processingMessage = :processingMessage',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#processedAt': 'processedAt',
          '#processingMessage': 'processingMessage',
        },
        ExpressionAttributeValues: {
          ':status': 'PROCESSED_SIMPLE', // Updated status for refined Lambda
          ':processedAt': processedAt,
          ':processingMessage': `Successfully processed by refined ProcessPanicLambda at ${processedAt}.`,
        },
        ReturnValues: "UPDATED_NEW" as const,
      };

      await ddbDocClient.send(new UpdateCommand(updateParams));
      console.log(`[panicId: ${panicId}, SQS Message ID: ${record.messageId}] Successfully updated status to PROCESSED_SIMPLE in DynamoDB.`);

      // Deferred:
      // 1. Fetch more details if needed.
      // 2. Call external services (GeoIP, User Details).
      // 3. Write enriched data to Aurora.
      // 4. Update status to COMPLETED or ERROR based on full processing.

    } catch (error) {
      // Log the error with panicId (if available) and SQS message ID
      const idForLog = panicId ? `panicId: ${panicId}` : `SQS Message ID: ${record.messageId}`;
      console.error(`[${idForLog}] Error processing SQS record. Record body: ${record.body}. Error:`, error);
      
      // Re-throw the error to ensure the message is not deleted from the queue
      // and SQS can handle retries / DLQ.
      throw error;
    }
  }
};
