-- Custom script to increase number of character in comment and comment in route st
alter table public.t_route_step add RTP_COMMENT_CONFIG_C varchar(2000) null;
alter table T_ROUTE_STEP alter column RTP_COMMENT_C type text using RTP_COMMENT_C::text;
alter table T_COMMENT alter column COM_CONTENT_C type text using COM_CONTENT_C::text;
insert into T_CONFIG (CFG_ID_C, CFG_VALUE_C) values('AUTO_SEPARATE_ZIP_REGEX', 'DICOM.zip');
insert into T_CONFIG (CFG_ID_C, CFG_VALUE_C) values('DICOM_NAME_REGEX', '^IM\d+$|.+\.dcm$');