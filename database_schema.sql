--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.equipment_requests DROP CONSTRAINT IF EXISTS equipment_requests_to_facility_fkey;
ALTER TABLE IF EXISTS ONLY public.equipment_requests DROP CONSTRAINT IF EXISTS equipment_requests_from_facility_fkey;
ALTER TABLE IF EXISTS ONLY public.equipment_requests DROP CONSTRAINT IF EXISTS equipment_requests_equipment_id_fkey;
ALTER TABLE IF EXISTS ONLY public.equipment DROP CONSTRAINT IF EXISTS equipment_hospital_id_fkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.laboratories DROP CONSTRAINT IF EXISTS laboratories_pkey;
ALTER TABLE IF EXISTS ONLY public.hospitals DROP CONSTRAINT IF EXISTS hospitals_pkey;
ALTER TABLE IF EXISTS ONLY public.facilities DROP CONSTRAINT IF EXISTS facilities_pkey;
ALTER TABLE IF EXISTS ONLY public.equipment_requests DROP CONSTRAINT IF EXISTS equipment_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.equipment DROP CONSTRAINT IF EXISTS equipment_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.laboratories ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.hospitals ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.facilities ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.equipment_requests ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.equipment ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.laboratories_id_seq;
DROP TABLE IF EXISTS public.laboratories;
DROP SEQUENCE IF EXISTS public.hospitals_id_seq;
DROP TABLE IF EXISTS public.hospitals;
DROP SEQUENCE IF EXISTS public.facilities_id_seq;
DROP TABLE IF EXISTS public.facilities;
DROP SEQUENCE IF EXISTS public.equipment_requests_id_seq;
DROP TABLE IF EXISTS public.equipment_requests;
DROP SEQUENCE IF EXISTS public.equipment_id_seq;
DROP TABLE IF EXISTS public.equipment;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(100),
    facility_id integer,
    availability boolean DEFAULT true,
    description text,
    quantity integer DEFAULT 1
);


--
-- Name: equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipment_id_seq OWNED BY public.equipment.id;


--
-- Name: equipment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_requests (
    id integer NOT NULL,
    equipment_id integer,
    from_facility integer,
    to_facility integer,
    notes text,
    status character varying(50) DEFAULT 'pending'::character varying,
    quantity integer DEFAULT 1,
    rejection_reason text,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: equipment_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipment_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipment_requests_id_seq OWNED BY public.equipment_requests.id;


--
-- Name: facilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facilities (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    address character varying(255),
    contact_email character varying(255),
    contact_phone character varying(50),
    facility_type character varying(50) DEFAULT 'laboratory'::character varying,
    latitude double precision,
    longitude double precision,
    services text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: facilities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facilities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facilities_id_seq OWNED BY public.facilities.id;


--
-- Name: hospitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hospitals (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    location character varying(255),
    contact_email character varying(255),
    contact_phone character varying(50),
    facility_type character varying(50) DEFAULT 'hospital'::character varying,
    latitude double precision,
    longitude double precision,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hospitals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hospitals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hospitals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hospitals_id_seq OWNED BY public.hospitals.id;


--
-- Name: laboratories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.laboratories (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    location character varying(255),
    contact_email character varying(255),
    contact_phone character varying(50),
    facility_type character varying(50) DEFAULT 'laboratory'::character varying,
    latitude double precision,
    longitude double precision,
    services text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: laboratories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.laboratories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: laboratories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.laboratories_id_seq OWNED BY public.laboratories.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: equipment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment ALTER COLUMN id SET DEFAULT nextval('public.equipment_id_seq'::regclass);


--
-- Name: equipment_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_requests ALTER COLUMN id SET DEFAULT nextval('public.equipment_requests_id_seq'::regclass);


--
-- Name: facilities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities ALTER COLUMN id SET DEFAULT nextval('public.facilities_id_seq'::regclass);


--
-- Name: hospitals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals ALTER COLUMN id SET DEFAULT nextval('public.hospitals_id_seq'::regclass);


--
-- Name: laboratories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.laboratories ALTER COLUMN id SET DEFAULT nextval('public.laboratories_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);


--
-- Name: equipment_requests equipment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_requests
    ADD CONSTRAINT equipment_requests_pkey PRIMARY KEY (id);


--
-- Name: facilities facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (id);


--
-- Name: hospitals hospitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_pkey PRIMARY KEY (id);


--
-- Name: laboratories laboratories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.laboratories
    ADD CONSTRAINT laboratories_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_hospital_id_fkey FOREIGN KEY (facility_id) REFERENCES public.hospitals(id) ON DELETE SET NULL;


--
-- Name: equipment_requests equipment_requests_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_requests
    ADD CONSTRAINT equipment_requests_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE SET NULL;


--
-- Name: equipment_requests equipment_requests_from_facility_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_requests
    ADD CONSTRAINT equipment_requests_from_facility_fkey FOREIGN KEY (from_facility) REFERENCES public.facilities(id) ON DELETE SET NULL;


--
-- Name: equipment_requests equipment_requests_to_facility_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_requests
    ADD CONSTRAINT equipment_requests_to_facility_fkey FOREIGN KEY (to_facility) REFERENCES public.facilities(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

