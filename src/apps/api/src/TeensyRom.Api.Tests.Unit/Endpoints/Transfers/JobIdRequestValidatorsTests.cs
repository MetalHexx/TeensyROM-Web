using TeensyRom.Api.Endpoints.Transfers.CancelJob;
using TeensyRom.Api.Endpoints.Transfers.GetJob;
using TeensyRom.Api.Endpoints.Transfers.SealJob;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Transfers;

/// <summary>
/// Seal, cancel, and get all share the same job-id-only request shape and rejection rule.
/// </summary>
public class JobIdRequestValidatorsTests
{
    [Fact]
    public void SealJobRequestValidator_EmptyJobId_FailsWithJobIdError()
    {
        var result = new SealJobRequestValidator().Validate(new SealJobRequest { JobId = "" });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(SealJobRequest.JobId));
    }

    [Fact]
    public void SealJobRequestValidator_NonEmptyJobId_HasNoErrors()
    {
        var result = new SealJobRequestValidator().Validate(new SealJobRequest { JobId = "job-1" });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void CancelJobRequestValidator_EmptyJobId_FailsWithJobIdError()
    {
        var result = new CancelJobRequestValidator().Validate(new CancelJobRequest { JobId = "" });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CancelJobRequest.JobId));
    }

    [Fact]
    public void CancelJobRequestValidator_NonEmptyJobId_HasNoErrors()
    {
        var result = new CancelJobRequestValidator().Validate(new CancelJobRequest { JobId = "job-1" });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void GetJobRequestValidator_EmptyJobId_FailsWithJobIdError()
    {
        var result = new GetJobRequestValidator().Validate(new GetJobRequest { JobId = "" });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(GetJobRequest.JobId));
    }

    [Fact]
    public void GetJobRequestValidator_NonEmptyJobId_HasNoErrors()
    {
        var result = new GetJobRequestValidator().Validate(new GetJobRequest { JobId = "job-1" });

        result.IsValid.Should().BeTrue();
    }
}
