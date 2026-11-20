class Snowflake {
  private static EPOCH = 1672531200000; // Jan 1 2023
  private static workerIdBits = 5;
  private static datacenterIdBits = 5;
  private static sequenceBits = 12;

  private static maxWorkerId = -1 ^ (-1 << Snowflake.workerIdBits);
  private static maxDatacenterId = -1 ^ (-1 << Snowflake.datacenterIdBits);

  private static workerIdShift = Snowflake.sequenceBits;
  private static datacenterIdShift = Snowflake.sequenceBits + Snowflake.workerIdBits;
  private static timestampLeftShift = Snowflake.sequenceBits + Snowflake.workerIdBits + Snowflake.datacenterIdBits;
  private static sequenceMask = -1 ^ (-1 << Snowflake.sequenceBits);

  private workerId: number;
  private datacenterId: number;
  private sequence = 0;
  private lastTimestamp = -1;

  constructor(workerId: number, datacenterId: number) {
    if (workerId > Snowflake.maxWorkerId || workerId < 0) {
      throw new Error(`worker Id can't be greater than ${Snowflake.maxWorkerId} or less than 0`);
    }
    if (datacenterId > Snowflake.maxDatacenterId || datacenterId < 0) {
      throw new Error(`datacenter Id can't be greater than ${Snowflake.maxDatacenterId} or less than 0`);
    }
    this.workerId = workerId;
    this.datacenterId = datacenterId;
  }

  private timeGen() {
    return Date.now();
  }

  private tilNextMillis(lastTimestamp: number) {
    let timestamp = this.timeGen();
    while (timestamp <= lastTimestamp) {
      timestamp = this.timeGen();
    }
    return timestamp;
  }

  public nextId(): string {
    let timestamp = this.timeGen();

    if (timestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards.');
    }

    if (this.lastTimestamp === timestamp) {
      this.sequence = (this.sequence + 1) & Snowflake.sequenceMask;
      if (this.sequence === 0) {
        timestamp = this.tilNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    const ts = BigInt(timestamp - Snowflake.EPOCH);
    const id = (ts << BigInt(Snowflake.timestampLeftShift)) |
               (BigInt(this.datacenterId) << BigInt(Snowflake.datacenterIdShift)) |
               (BigInt(this.workerId) << BigInt(Snowflake.workerIdShift)) |
               BigInt(this.sequence);

    return id.toString();
  }
}

// Global instance
export const snowflake = new Snowflake(1, 1);
