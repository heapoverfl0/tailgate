locals {
  account_id = "965984382163"
  region     = "us-east-2"
  name       = "tailgate"
}

provider "aws" {
  region                   = local.region
  allowed_account_ids      = [local.account_id]
  profile                  = "tailgate-personal"
  shared_config_files      = [pathexpand("~/.config/tailgate/aws/config")]
  shared_credentials_files = [pathexpand("~/.config/tailgate/aws/credentials")]
  skip_metadata_api_check  = true

  default_tags {
    tags = {
      Project   = "Tailgate"
      ManagedBy = "Terraform"
    }
  }
}
