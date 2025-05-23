// loaders.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors
// Copyright (c) 2017 ironSource Ltd.
// Forked from https://github.com/kbajalc/parquets under MIT license

/* tslint:disable */
/* eslint-disable */
/*
 * Autogenerated by @creditkarma/thrift-typescript v3.7.2
 * DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
 */
import Int64 from 'node-int64';
import * as thrift from 'thrift';
export interface IStatisticsArgs {
  max?: Buffer;
  min?: Buffer;
  null_count?: number | Int64;
  distinct_count?: number | Int64;
  max_value?: Buffer;
  min_value?: Buffer;
}
export class Statistics {
  public max?: Buffer;
  public min?: Buffer;
  public null_count?: Int64;
  public distinct_count?: Int64;
  public max_value?: Buffer;
  public min_value?: Buffer;
  constructor(args?: IStatisticsArgs) {
    if (args != null && args.max != null) {
      this.max = args.max;
    }
    if (args != null && args.min != null) {
      this.min = args.min;
    }
    if (args != null && args.null_count != null) {
      if (typeof args.null_count === 'number') {
        this.null_count = new Int64(args.null_count);
      } else {
        this.null_count = args.null_count;
      }
    }
    if (args != null && args.distinct_count != null) {
      if (typeof args.distinct_count === 'number') {
        this.distinct_count = new Int64(args.distinct_count);
      } else {
        this.distinct_count = args.distinct_count;
      }
    }
    if (args != null && args.max_value != null) {
      this.max_value = args.max_value;
    }
    if (args != null && args.min_value != null) {
      this.min_value = args.min_value;
    }
  }
  public write(output: thrift.TProtocol): void {
    output.writeStructBegin('Statistics');
    if (this.max != null) {
      output.writeFieldBegin('max', thrift.Thrift.Type.STRING, 1);
      output.writeBinary(this.max);
      output.writeFieldEnd();
    }
    if (this.min != null) {
      output.writeFieldBegin('min', thrift.Thrift.Type.STRING, 2);
      output.writeBinary(this.min);
      output.writeFieldEnd();
    }
    if (this.null_count != null) {
      output.writeFieldBegin('null_count', thrift.Thrift.Type.I64, 3);
      output.writeI64(this.null_count);
      output.writeFieldEnd();
    }
    if (this.distinct_count != null) {
      output.writeFieldBegin('distinct_count', thrift.Thrift.Type.I64, 4);
      output.writeI64(this.distinct_count);
      output.writeFieldEnd();
    }
    if (this.max_value != null) {
      output.writeFieldBegin('max_value', thrift.Thrift.Type.STRING, 5);
      output.writeBinary(this.max_value);
      output.writeFieldEnd();
    }
    if (this.min_value != null) {
      output.writeFieldBegin('min_value', thrift.Thrift.Type.STRING, 6);
      output.writeBinary(this.min_value);
      output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
  }
  public static read(input: thrift.TProtocol): Statistics {
    input.readStructBegin();
    let _args: any = {};
    while (true) {
      const ret: thrift.TField = input.readFieldBegin();
      const fieldType: thrift.Thrift.Type = ret.ftype;
      const fieldId: number = ret.fid;
      if (fieldType === thrift.Thrift.Type.STOP) {
        break;
      }
      switch (fieldId) {
        case 1:
          if (fieldType === thrift.Thrift.Type.STRING) {
            const value_1: Buffer = input.readBinary();
            _args.max = value_1;
          } else {
            input.skip(fieldType);
          }
          break;
        case 2:
          if (fieldType === thrift.Thrift.Type.STRING) {
            const value_2: Buffer = input.readBinary();
            _args.min = value_2;
          } else {
            input.skip(fieldType);
          }
          break;
        case 3:
          if (fieldType === thrift.Thrift.Type.I64) {
            const value_3: Int64 = input.readI64();
            _args.null_count = value_3;
          } else {
            input.skip(fieldType);
          }
          break;
        case 4:
          if (fieldType === thrift.Thrift.Type.I64) {
            const value_4: Int64 = input.readI64();
            _args.distinct_count = value_4;
          } else {
            input.skip(fieldType);
          }
          break;
        case 5:
          if (fieldType === thrift.Thrift.Type.STRING) {
            const value_5: Buffer = input.readBinary();
            _args.max_value = value_5;
          } else {
            input.skip(fieldType);
          }
          break;
        case 6:
          if (fieldType === thrift.Thrift.Type.STRING) {
            const value_6: Buffer = input.readBinary();
            _args.min_value = value_6;
          } else {
            input.skip(fieldType);
          }
          break;
        default: {
          input.skip(fieldType);
        }
      }
      input.readFieldEnd();
    }
    input.readStructEnd();
    return new Statistics(_args);
  }
}
