# Attio n8n community node

Attio is a flexible CRM for managing customer records, deals, lists, and sales workflows.

Generated from OpenAPI 2.0.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated OAuth 2.0 credential in n8n before using the node.

## Supported operations

- `DELETE /v2/activities/{activity}` - Delete an activity
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/activities` - List activities
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/activities/{activity}` - Get an activity
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/activities/{activity}` - Update an activity
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/activities` - Create an activity
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /v2/activities/{activity}/records/{record_id}` - Delete an activity record
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/activities/{activity}/records/{record_id}` - Get an activity record
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/activities/{activity}/records/{record_id}` - Update an activity record
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/activities/{activity}/records` - Create an activity record
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/activities/{activity}/records/query` - List activity records
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /v2/activities/{activity}/records` - Upsert an activity record
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /v2/activities/{activity}/records/{record_id}` - Update an activity record
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/{target}/{identifier}/attributes` - List attributes
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/{target}/{identifier}/attributes/{attribute}` - Get an attribute
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/{target}/{identifier}/attributes/{attribute}/options` - List select options
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/{target}/{identifier}/attributes/{attribute}/statuses` - List statuses
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/{target}/{identifier}/attributes/{attribute}` - Update an attribute
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/{target}/{identifier}/attributes/{attribute}/options/{option}` - Update a select option
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/{target}/{identifier}/attributes/{attribute}/statuses/{status}` - Update a status
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/{target}/{identifier}/attributes` - Create an attribute
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/{target}/{identifier}/attributes/{attribute}/options` - Create a select option
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/{target}/{identifier}/attributes/{attribute}/statuses` - Create a status
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /v2/meetings/{meeting_id}/call_recordings/{call_recording_id}` - Delete call recording
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/meetings/{meeting_id}/call_recordings` - List call recordings
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/meetings/{meeting_id}/call_recordings/{call_recording_id}` - Get call recording
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/meetings/{meeting_id}/call_recordings` - Create call recording
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /v2/comments/{comment_id}` - Delete a comment
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/comments/{comment_id}` - Get a comment
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/comments` - Create a comment
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/emails` - List emails
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /v2/lists/{list}/entries/{entry_id}` - Delete a list entry
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/lists/{list}/entries/{entry_id}` - Get a list entry
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/lists/{list}/entries/{entry_id}/attributes/{attribute}/values` - List attribute values for a list entry
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/lists/{list}/entries/{entry_id}` - Update a list entry (append multiselect values)
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/lists/{list}/entries` - Create an entry (add record to list)
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/lists/{list}/entries/query` - List entries
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /v2/lists/{list}/entries` - Upsert a list entry by parent
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /v2/lists/{list}/entries/{entry_id}` - Update a list entry (overwrite multiselect values)
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /v2/lists/{list}/entries/{entry_id}/attributes/{attribute}/values` - Write list entry attribute values
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /v2/files/{file_id}` - Delete a file
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/files` - List files
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/files/{file_id}` - Get a file
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/files/{file_id}/download` - Download a file
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/files` - Create a folder
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/files/upload` - Upload a file
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/lists` - List all lists
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/lists/{list}` - Get a list
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/lists/{list}/views` - List views for list
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/lists/{list}` - Update a list
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/lists` - Create a list
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /v2/meetings/{meeting_id}` - Delete a meeting
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/meetings` - List meetings
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/meetings/{meeting_id}` - Get a meeting
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/meetings/{meeting_id}` - Update a meeting (append linked records)
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/meetings` - Create a meeting
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /v2/meetings/{meeting_id}` - Update a meeting (overwrite linked records)
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/self` - Identify
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /v2/notes/{note_id}` - Delete a note
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/notes` - List notes
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/notes/{note_id}` - Get a note
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/notes/{note_id}` - Update a note
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/notes` - Create a note
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /v2/objects/{object}` - Delete an object
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/objects` - List objects
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/objects/{object}` - Get an object
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/objects/{object}/views` - List views for object
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/objects/{object}` - Update an object
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/objects` - Create an object
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /v2/objects/{object}/records/{record_id}` - Delete a record
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/objects/{object}/records/{record_id}` - Get a record
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/objects/{object}/records/{record_id}/attributes/{attribute}/values` - List record attribute values
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/objects/{object}/records/{record_id}/entries` - List record entries
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/objects/{object}/records/{record_id}` - Update a record (append multiselect values)
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/objects/{object}/records` - Create a record
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/objects/{object}/records/merge` - Merge two records
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/objects/{object}/records/query` - List records
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/objects/records/search` - Search records
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /v2/objects/{object}/records` - Upsert a record
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /v2/objects/{object}/records/{record_id}` - Update a record (overwrite multiselect values)
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /v2/objects/{object}/records/{record_id}/attributes/{attribute}/values` - Write record attribute values
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/sequences/unsubscribed_emails` - Add emails to the unsubscribe list
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/sql` - Query SQL
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /v2/tasks/{task_id}` - Delete a task
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/tasks` - List tasks
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/tasks/{task_id}` - Get a task
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/tasks/{task_id}` - Update a task
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/tasks` - Create a task
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/threads` - List threads
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/threads/{thread_id}` - Get a thread and its comments
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/meetings/{meeting_id}/call_recordings/{call_recording_id}/transcript` - Deprecated: Get call transcript
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /v2/webhooks/{webhook_id}` - Delete a webhook
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/webhooks` - List webhooks
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/webhooks/{webhook_id}` - Get a webhook
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v2/webhooks/{webhook_id}` - Update a webhook
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v2/webhooks` - Create a webhook
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/workspace_members` - List workspace members
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v2/workspace_members/{workspace_member_id}` - Get a workspace member
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **Attio** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **Attio** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **Attio** display name.
