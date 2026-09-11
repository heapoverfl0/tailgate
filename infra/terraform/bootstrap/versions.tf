terraform {
  required_version = ">= 1.11.0, < 2.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.64.0"
    }
  }
  # Created with local state; now migrated to its own key in the state bucket.
  backend "s3" {}
}
