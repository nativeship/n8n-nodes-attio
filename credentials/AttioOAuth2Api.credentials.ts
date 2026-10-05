import { type Icon, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class AttioOAuth2Api implements ICredentialType {
  name = "attioOAuth2Api";
  extends = [
        "oAuth2Api"
    ];
  displayName = "Attio OAuth2 API";
  icon: Icon = {
        light: "file:../nodes/Attio/attio.svg",
        dark: "file:../nodes/Attio/attio.dark.svg"
    };
  documentationUrl = "https://api.attio.com";
  properties: INodeProperties[] = [
        {
            displayName: "Grant Type",
            name: "grantType",
            type: "hidden",
            default: "authorizationCode"
        },
        {
            displayName: "Authorization URL",
            name: "authUrl",
            type: "hidden",
            default: "https://app.attio.com/authorize"
        },
        {
            displayName: "Access Token URL",
            name: "accessTokenUrl",
            type: "hidden",
            default: "https://app.attio.com/oauth/token"
        },
        {
            displayName: "Scope",
            name: "scope",
            type: "hidden",
            default: "activity_configuration:read activity_configuration:read-write activity_record:read activity_record:read-write call_recording:read call_recording:read-write comment:read comment:read-write email:read file:read file:read-write list_configuration:read list_configuration:read-write list_entry:read list_entry:read-write meeting:read meeting:read-write note:read note:read-write object_configuration:read object_configuration:read-write record_permission:read record_permission:read-write sequence_unsubscribe:read-write task:read task:read-write user_management:read webhook:read webhook:read-write"
        }
    ];
}
